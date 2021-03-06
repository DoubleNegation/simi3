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

//command to use for the spinner option choosing menu
const SPINNER_MENU_COMMAND = "dmenu -b -l 20";

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
        if(navOffset > 0 || (navOffset > -1 && navLoc.length > 0)) {
            navOffset--;
        } else {
            navOffset = maxId;
        }
        displayStatus();
    } else if(line === "next") {
        let maxId = findHighestActivatableId();
        if(navOffset === maxId) {
            navOffset = navLoc.length > 0 ? -1 : 0;
        } else {
            navOffset++;
        }
        displayStatus();
    } else if(line === "activate") {
        if(navOffset === -1) {
            //back button
            leaveCurrentMode();
            let obj = navLoc.pop();
            navOffset = obj.offset;
            enterMode(obj.mode);
            loop();
        } else {
            let i = navOffset;
            if(activateActivatable(navOffset)) {
                navOffset = findHighestActivatableId() === -1 ? -1 : 0;
                displayStatus();
            }
        }
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
    } else if(line === "inc") {
        let schedule = getScheduleObjectByActivatableId(navOffset);
        if(CONFIG.modes[currentMode].contents[schedule.id].type !== "spinner") return;
        if(schedule.spinnerIndex < schedule.latestResult.length - 1) {
            schedule.spinnerIndex++;
            doScrollAction(schedule.id);
            displayStatus();
        }
    } else if(line === "dec") {
        let schedule = getScheduleObjectByActivatableId(navOffset);
        if(CONFIG.modes[currentMode].contents[schedule.id].type !== "spinner") return;
        if(schedule.spinnerIndex > 0) {
            schedule.spinnerIndex--;
            doScrollAction(schedule.id);
            displayStatus();
        }
    } else if(line === "spinnermenu") {
        let schedule = getScheduleObjectByActivatableId(navOffset);
        if(CONFIG.modes[currentMode].contents[schedule.id].type !== "spinner") return;
        showSpinnerMenu(schedule.id);
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
    if(data.button === 4) {
        //scroll up
        if(data.name === "simi3-back") return;
        let id = parseInt(data.name);
        let modeCfg = CONFIG.modes[currentMode].contents[id];
        if(modeCfg.activatable && modeCfg.type === "spinner") {
            let schedule = currentModeSchedules[id];
            if(schedule.spinnerIndex < schedule.latestResult.length - 1) {
                schedule.spinnerIndex++;
                doScrollAction(id);
                displayStatus();
            }
        }
    } else if(data.button === 5) {
        //scroll down
        if(data.name === "simi3-back") return;
        let id = parseInt(data.name);
        let modeCfg = CONFIG.modes[currentMode].contents[id];
        if(modeCfg.activatable && modeCfg.type === "spinner") {
            let schedule = currentModeSchedules[id];
            if(schedule.spinnerIndex > 0) {
                schedule.spinnerIndex--;
                doScrollAction(id);
                displayStatus();
            }
        }
    } else if(data.name === "simi3-back" || data.button === 3) {
        //back button or RMB was clicked, go back to previous menu
        if(navLoc.length === 0) return;
        leaveCurrentMode();
        let obj = navLoc.pop();
        navOffset = obj.offset;
        enterMode(obj.mode);
        loop();
    } else if(data.button === 2) {
        //choose spinner value
        if(data.name === "simi3-back") return;
        let id = parseInt(data.name);
        let modeCfg = CONFIG.modes[currentMode].contents[id];
        if(modeCfg.type === "spinner") {
            showSpinnerMenu(id);
        }
    } else if(data.button === 1) {
        //activate
        let theId = parseInt(data.name);
        let oldMode = CONFIG.modes[currentMode];
        if(oldMode.contents[theId].activatable) {
            if(activateActivatable(currentModeSchedules[theId].activatableId)) {
                navOffset = findHighestActivatableId() === -1 ? -1 : 0;
                displayStatus();
            }
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
                let cfg = CONFIG.modes[currentMode].contents[schedule.id];
                if(cfg.type === "spinner") {
                    schedule.latestResult = [];
                    schedule.spinnerValues = [];
                    let targetIndex = 0;
                    result.forEach((e, i) => {
                        schedule.latestResult.push(textComponentToPangoMarkup(e.display));
                        schedule.spinnerValues.push(e.value);
                        if(e.defaultSelection) targetIndex = i;
                    });
                    if(schedule.spinnerIndex === -1) schedule.spinnerIndex = targetIndex;
                } else {
                    schedule.latestResult = textComponentToPangoMarkup(result);
                }
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
        let schedule = {
            schedule: content.schedule,
            counter: -2,
            generator: content.generator,
            currentActivity: undefined,
            latestResult: content.type === "spinner" ? ["..."] : "...",
            id: index,
            activatableId: content.activatable ? activatableCounter++ : -2
        };
        if(content.type === "spinner") {
            schedule.spinnerIndex = -1;
        }
        currentModeSchedules.push(schedule);
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
            full_text: navOffset === -1 && inBarNavMode ? 
                "<span color=\"#ffaaaa\" bgcolor=\"#880000\">[</span>" +
                "<span color=\"#aaaaaa\">Back</span>" +
                "<span color=\"#ffaaaa\" bgcolor=\"#880000\">]</span>" : 
                "<span color=\"#aaaaaa\"> Back </span>",
            name: "simi3-back",
            markup: "pango"
        });
    }
    currentModeSchedules.forEach(e => {
        let cfg = CONFIG.modes[currentMode].contents[e.id];
        if(!cfg.type || cfg.type === "default") {
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
        } else if(cfg.type === "spinner") {
            if(inBarNavMode && navOffset === e.activatableId) {
                components.push({
                    full_text: "<span color=\"#ffaaaa\" bgcolor=\"#880000\">[</span>" + 
                        e.latestResult[e.spinnerIndex] + 
                        "<span color=\"#ffaaaa\" bgcolor=\"#880000\">" +
                        (e.spinnerIndex === e.latestResult.length - 1 ? " " : "&#8593;") +
                        (e.spinnerIndex === 0 ? " " : "&#8595;") +
                        "]</span>",
                    markup: "pango",
                    name: "" + e.id
                });
            } else {
                components.push({
                    full_text: " " + e.latestResult[e.spinnerIndex] +
                        (e.spinnerIndex === e.latestResult.length - 1 ? " " : "&#8593;") +
                        (e.spinnerIndex === 0 ? " " : "&#8595;") + " ",
                    markup: "pango",
                    name: "" + e.id
                });
            }
        } else {
            components.push({
                full_text: " ERROR: unknown type \"" + cfg.type + "\" ",
                color: "#ff0000",
                name: "" + e.id
            });
        }
    });
    console.log(JSON.stringify(components) + ",");
}

function findHighestActivatableId() {
    for(let i = currentModeSchedules.length - 1; i >= 0; i--) {
        if(currentModeSchedules[i].activatableId !== -2) {
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
                log.write(e.toString() + "\n");
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

function getScheduleObjectByActivatableId(activatableId) {
    try {
        currentModeSchedules.forEach(e => {
            if(e.activatableId === activatableId) {
                throw e;
            }
        });
    } catch(schedule) {
        return schedule;
    }
}

//returns true if the cursor needs to be reset
function activateActivatable(activatableId) {
    let obj = getScheduleObjectByActivatableId(activatableId);
    let cobj = CONFIG.modes[currentMode].contents[obj.id];
    if(cobj.activateAction instanceof Array) {
        let returnValue = false;
        cobj.activateAction.forEach(e => {
            if(doActivateAction(e, cobj, activatableId, obj)) {
                returnValue = true;
            }
        });
        return returnValue;
    } else {
        return doActivateAction(cobj.activateAction, cobj, activatableId, obj);
    }
}

//returns true if the cursor needs to be reset
function doScrollAction(id) {
    let content = CONFIG.modes[currentMode].contents[id];
    let schedule = currentModeSchedules[id];
    let activatebleId = schedule.activatableId;
    let action = content.scrollAction;
    if(!action) return;
    if(action instanceof Array) {
        let returnValue = false;
        action.forEach(e => {
            if(doActivateAction(e, content, activatebleId, schedule)) {
                returnValue = true;
            }
        });
        return returnValue;
    } else {
        return doActivateAction(action, content, activatableId, schedule);
    }
}

//retrns true if the cursor needs to be reset
function doActivateAction(actionName, barComponent, activatableId, highlightedSchedule) {
    if(actionName === "modeswitch") {
        navLoc.push({mode:currentMode,offset:activatableId});
        leaveCurrentMode();
        enterMode(barComponent.modeswitchGoal);
        displayStatus();
        loop();
        return true;
    } else if(actionName === "modeback") {
        let to = navLoc.pop();
        navOffset = to.offset;
        leaveCurrentMode();
        enterMode(to.mode);
        displayStatus();
        loop();
        return false;
    } else if(actionName === "exec") {
        child_process.exec(barComponent.execCommand);
        return false;
    } else if(actionName === "leavebarmode") {
        if(inBarNavMode) {
            child_process.exec("i3-msg \"mode \\\"default\\\"\"");
            inBarNavMode = false;
        }
        return false;
    } else if(actionName === "modeswitchtospinnervalue") {
        navLoc.push({mode:currentMode,offset:activatableId});
        let to = highlightedSchedule.spinnerValues[highlightedSchedule.spinnerIndex];
        leaveCurrentMode();
        enterMode(to);
        displayStatus();
        loop();
        return true;
    } else if(actionName === "execspinnervalue") {
        child_process.exec(highlightedSchedule.spinnerValues[highlightedSchedule.spinnerIndex]);
        return false;
    } else if(actionName === "refreshthis") {
        //immediately runs the generator for the activated element
        if(highlightedSchedule.counter !== -1) {
            highlightedSchedule.counter = -2;
            loop();
            displayStatus();
        }
        return false;
    } else if(actionName === "refreshall") {
        //immediately runs all the generatos for all displayed elements
        currentModeSchedules.forEach(schedule => {
            if(schedule.counter !== -1) {
                schedule.counter = -2;
            }
        });
        loop();
        displayStatus();
        return false;
    }
}

function showSpinnerMenu(id) {
    let schedule = currentModeSchedules[id];
    let options = schedule.latestResult;
    let prettyOptions = [];
    options.forEach(option => {
        prettyOptions.push(option.replace(/<.*?>/g, "").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/%gt;/g, ">"));
    });
    let proc = child_process.exec(SPINNER_MENU_COMMAND, (error, stdout, stderr) => {
        let input = stdout.substring(0, stdout.length - 1);
        if(prettyOptions.includes(input)) {
            schedule.spinnerIndex = prettyOptions.indexOf(input);
            doScrollAction(id);
            displayStatus();
        }
    });
    proc.stdin.write(prettyOptions.join("\n") + "\n");
    proc.stdin.end();
}

