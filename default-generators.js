"use strict";

/*
 * Copyright (c) 2018, DoubleNegation
 * All rights reserved.
 * 
 * Published under the FreeBSD ("2-clause") license.
 * See the included file "LICENSE" for details.
 */

//require the node modules that the generators need
const child_process = require("child_process");
const util = require("util");

//constants that are needed by some of the generators
const myExec = util.promisify(child_process.exec);

//add a foreach function to the array that can work in async functions
//and allows for breaking to save cpu time.
Array.betterBreak = {betterBreak: "betterBreak"};
Array.prototype.asyncBetterForeach = async function(func) {
    for(let i = 0; i < this.length; i++) {
        let e = await func(this[i], i);
        if(e === Array.betterBreak) break;
    }
}

//export the generators.
//they are assigned to a variable on the other end.
module.exports = {
    PlainText: function mkPlainTextGenerator(text) {
        return async function plaintextGenerator() {
            return [{text: text}];
        }
    },
    DateTime: function mkDatetimeGenerator() {
        return async function datetimeGenerator() {
            const daynames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            let d = new Date();
            return [
                {
                    text: daynames[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ". "
                },
                {
                    text: d.getHours() + ":" + (d.getMinutes() < 10 ? ("0" + d.getMinutes()) : d.getMinutes()),
                    fontWeight: "bold"
                }
            ];
        }
    },
    Wifi: function mkWifiGenerator(deviceName, showDeviceName) {
        return async function wifiGenerator() {
            const barsColors = ["#ff3600", "#ff7900", "#ffe500", "#b4ff00", "#00ff00"];
            let data = (await myExec("nmcli dev wifi list ifname " + deviceName)).stdout;
            let returnValue;
            await data.split("\n").asyncBetterForeach(async function(e) {    
                //the trim is neccessary because there might be spaces at the end
                //of the line, depending on how long the different "SECURITY" rows are
                let tokens = e.trim().split(/\s\s+/g);
                if(tokens[0] === "*") {
                    let networkName;
                    if(tokens[tokens.length - 2] === "0") {
                        //the signal strength is 0, so the bar column is empty and must not be counted
                        networkName = tokens.slice(1, tokens.length - 5).join(" ");
                    } else {
                        networkName = tokens.slice(1, tokens.length - 6).join(" ");
                    }
                    let bars = tokens[tokens.length - 2].length;
                    let barsStr = "▂▄▆█".substr(0, bars);
                    while(barsStr.length < 4) barsStr += "_";
                    returnValue = [{
                        text: (showDeviceName ? "Wifi(" + deviceName + "): " : "Wifi: ") + networkName + " " + barsStr,
                        color: barsColors[bars]
                    }];
                    return Array.betterBreak;
                }
            });
            if(returnValue === undefined) {
                returnValue = [{
                    text: showDeviceName ? "Wifi(" + deviceName + "): disconnected" : "Wifi: disconnected",
                    color: "#ff3311"
                }];
            } else {
                //we are connected, gotta find out the ip address
                //the ip address can be obtained via the ip command
                let ipData = (await myExec("ip address show dev " + deviceName)).stdout.split("\n");
                ipData.forEach(el => {
                    let t = el.trim();
                    if(t.startsWith("inet ")) {
                        //this adds the IPv4 address to whataver is returned
                        returnValue[0].text += " " + t.split(" ")[1];
                    } else if(t.startsWith("inet6 ") && !t.startsWith("inet6 fe80")) {
                        //this adds the IPv6 address, unless it starts with fe80
                        returnValue[0].text += " " + t.split(" ")[1];
                    }
                });
            }
            return returnValue;
        }
    },
    TestSpinner: function mkTestSpinnerGenerator() {
        return async function testSpinnerGenerator() {
            return [[{
                text: "Test 1"
            }],[{
                text: "Test 2"
            }],[{
                text: "Adventurous ",
                color: "green"
            },{
                text: "Test",
                color: "blue"
            }],[{
                text: "Test 4"
            }]];
        }
    }
};


