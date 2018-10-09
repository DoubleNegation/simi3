#!/usr/bin/env node
"use strict";

/*
 * Copyright (c) 2018, DoubleNegation
 * All rights reserved.
 * 
 * Published under the FreeBSD ("2-clause") license.
 * See the included file "LICENSE" for details.
 */

//require all the libraries that will be neccessary throughout the script
const child_process = require("child_process");
const fs = require("fs");
const readline = require("readline");
//const util = require("util");

/*** CONFIGURATION SECTION START ***/

//configuration variables - change these as you will

//path to the named pipe that receives instructions
//if it doesn't exist, it will be created by the script using mkfifo(1)
const PIPE_LOC = "/home/(username)/.local/share/simi3/simi3.fifo";

//path to the log file
//specify "/dev/null" if you do not want to have a log file.
//from anywhere within the script, use log.write() to write to it.
//if an error is thrown inside a generator, it is written to the log.
const LOG_LOC = "/home/(username)/.local/share/simi3/simi3.log"; 

/*** CONFIGURATION SECTION END ***/

//if the pipe does not exist, create it
if(!fs.existsSync(PIPE_LOC)) {
    child_process.spawnSync("mkfifo", [PIPE_LOC]);
}

//make sure the pipe is always being read
let pipeReader;
const pipeCloseEvent = () => {
    pipeReader = readline.createInterface({
        input: fs.createReadStream(PIPE_LOC)
    });
    pipeReader.on("close", pipeCloseEvent);
    pipeReader.on("line", onPipeEvent);
};

//this gets called for each line written into the pipe
function onPipeEvent(line) {
    if(line === "modeswitch") {
        if(!inBarNavMode) {
            child_process.exec("i3-msg \"mode \\\"bar\\\"\"");
            inBarNavMode = true;
        } else {
            child_process.exec("i3-msg \"mode \\\"default\\\"\"");
            inBarNavMode = false;
        }
        displayStatus();
    } else if(line === "prev") {
        let maxId = findHighestActivatableId();
        if(navOffset > 0) {
            navOffset--;
        } else {
            navOffset = maxId;
        }
        displayStatus();
    } else if(line === "next") {
        let maxId = findHighestActivatableId();
        if(navOffset === maxId) {
            navOffset = 0;
        } else {
            navOffset++;
        }
        displayStatus();
    } else if(line === "activate") {
        let i = navOffset;
        navOffset = 0;
        activateActivatable(i);
    } else if(line === "ret") {
        if(navLoc.length === 0) {
            child_process.exec("i3-msg \"mode \\\"default\\\"\"");
            inBarNavMode = false;
        } else {
            let to = navLoc.pop();
            navOffset = to.offset;
            leaveCurrentMode();
            enterMode(to.mode);
            loop();
        }
        displayStatus();
    }
}

pipeCloseEvent();

//open the output stream to the log file.
//put it into the "global" object so the other files
//can access it aswell.
global.log = fs.createWriteStream(LOG_LOC);

//initialize the click event listener
const clickReadline = readline.createInterface({
    input: process.stdin
});
clickReadline.on("line", line => {
    if(line.startsWith("[")) return;
    if(line.startsWith(",")) line = line.substr(1);
    let data = JSON.parse(line);
    log.write(JSON.stringify(data));
    if(data.name === "simi3-back") {
        //back button was clicked, go back to previous menu
        leaveCurrentMode();
        let obj = navLoc.pop();
        navOffset = obj.offset;
        enterMode(obj.mode);
    } else {
        let theId = parseInt(data.name);
        let oldMode = CONFIG.modes[currentMode];
        if(oldMode.contents[theId].activatable) {
            activateActivatable(currentModeSchedules[theId].activatableId);
        }
    }
});

/*** CONFIGURATION SECTION START ***/

//load all generator sets into global.generators
global.generators = {};
global.generators.DefaultGenerators = require("./default-generators.js");

//load the bar configuration from config.js
const CONFIG = require("./config.js");

/*** CONFIGURATION SECTION END ***/

//send the header of the protocol that is used for communicating
//with i3bar
console.log(JSON.stringify({version:1,click_events:true}));
console.log("[");

//display the welcome message
console.log(JSON.stringify([{
    full_text: " Status Information and Management for i3 ",
    color: "#00ff00"
},{
    full_text: " https://github.com/DoubleNegation/simi3 ",
    color: "#ffff00"
},{
    full_text: " Starting up... ",
    color: "#7777ff"
}]) + ",");

//set a timeout for switching to the default mode
//once everything has initialized
setTimeout(() => {
    enterMode(CONFIG.default_mode);
}, 10);

let currentMode = undefined;
let currentModeSchedules = [];

let inBarNavMode = false;
let navLoc = [];
let navOffset = 0;

//this is the main program loop
function loop() {
    if(currentMode === undefined) return;
    currentModeSchedules.forEach(schedule => {
        //if the counter is -1 the generator is running right now
        if(schedule.counter === -1) return;
        //-2 means that the mode has just been entered and the
        //generator needs to be executed for the first time
        if(schedule.counter === -2 || schedule.counter >= schedule.schedule) {
            schedule.counter = -1;
            schedule.currentActivity = new Activity(schedule.generator);
            schedule.currentActivity.then(result => {
                schedule.counter = 1;
                schedule.currentActivity = undefined;
                schedule.latestResult = textComponentToPangoMarkup(result);
                displayStatus();
            });
            schedule.currentActivity.start();
        } else {
            schedule.counter++;
        }
    });
}

//make the loop be a loop
setInterval(loop, 500);

function leaveCurrentMode() {
    if(currentMode === undefined) return;
    currentModeSchedules.forEach(e => {
        if(e.currentActivity !== undefined) {
            e.currentActivity.markCancelled();
        }
    });
    currentModeSchedules = [];
    currentMode = undefined;
}

function enterMode(modeId) {
    if(!CONFIG.modes.hasOwnProperty(modeId)) return;
    let mode = CONFIG.modes[modeId];
    let activatableCounter = 0;
    mode.contents.forEach((content, index) => {
        currentModeSchedules.push({
            schedule: content.schedule,
            counter: -2,
            generator: content.generator,
            currentActivity: undefined,
            latestResult: "...",
            id: index,
            activatableId: content.activatable ?  activatableCounter++ : -1
        });
    });
    currentMode = modeId;
}

//print the current status situation to stdout so it is
//displayed on the i3bar
function displayStatus() {
    if(currentMode === undefined) return;
    let components = [];
    if(navLoc.length > 0) {
        //display the back button
        components.push({
            full_text: " Back ",
            color: "#aaaaaa",
            name: "simi3-back"
        });
    }
    currentModeSchedules.forEach(e => {
        if(inBarNavMode && navOffset === e.activatableId) {
            components.push({
                full_text: "<span color=\"#ffaaaa\" bgcolor=\"#880000\">[</span>" + 
                    e.latestResult + 
                    "<span color=\"#ffaaaa\" bgcolor=\"#880000\">]</span>",
                markup: "pango",
                name: "" + e.id
            });
        } else {
            components.push({
                full_text: " " + e.latestResult + " ",
                markup: "pango",
                name: "" + e.id
            });
        }
    });
    console.log(JSON.stringify(components) + ",");
}

function findHighestActivatableId() {
    for(let i = currentModeSchedules.length - 1; i >= 0; i--) {
        if(currentModeSchedules[i].activatableId !== -1) {
            return currentModeSchedules[i].activatableId;
        }
    }
    return -1;
}

//a wrapper class for the generators to mark them
//as cancelled when their return value is no longer
//required because the mode was changed by the user
class Activity {
    constructor(generator) {
        this.isCancelled = false;
        let _this = this;
        this.asyncfunc = async function() {
            try {
                _this.response = await generator();
                if(!_this.isCancelled) {
                    _this.thenfuncs.forEach(e => {
                        e(_this.response);
                    });
                }
            } catch(e) {
                log.write(e.toString());
            }
        };
        this.thenfuncs = [];
    }
    then(func) {
        this.thenfuncs.push(func);
    }
    markCancelled() {
        this.isCancelled = true;
    }
    start() {
        this.asyncfunc();
    }
    getResult() {
        return this.response;
    }
}

function textComponentToPangoMarkup(comp) {
    let converted = "";
    comp.forEach(e => {
        converted += "<span ";
        for(let key in e) {
            if(!e.hasOwnProperty(key) || key === "text") continue;
            let newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            converted += newKey + "=\"" + e[key] + "\" ";
        }
        converted += ">" + e.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") + "</span>";
    });
    return converted;
}

function activateActivatable(activatableId) {
    let obj;
    currentModeSchedules.forEach(e => {
        if(e.activatableId === activatableId) {
            obj = e;
        }
    });
    let cobj = CONFIG.modes[currentMode].contents[obj.id];
    if(cobj.activateAction === "modeswitch") {
        navLoc.push({mode:currentMode,offset:activatableId});
        leaveCurrentMode();
        enterMode(cobj.modeswitchGoal);
        displayStatus();
        loop();
    } else if(cobj.activateAction === "modeback") {
        let to = navLoc.pop();
        navOffset = to.offset;
        leaveCurrentMode();
        enterMode(to.mode);
        displayStatus();
        loop();
    } else if(cobj.activateAction === "exec") {
        child_process.exec(cobj.execCommand);
    }
}


