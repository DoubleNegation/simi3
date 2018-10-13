"use strict";

/*
 * Copyright (c) 2018, DoubleNegation
 * All rights reserved.
 * 
 * Published under the FreeBSD ("2-clause") license.
 * See the included file "LICENSE" for details.
 */

//unpack all the generator collections from global.generators
const {DefaultGenerators} = generators;

//what follows this comment is the configuration object.
//it specifies all the elements and functionality of the bar.
//the functions for regenerating the content of the bar
//are on a schedule that is specified in the configuration aswell.
//the number at the schedule is how many "ticks" to wait after
//the configuration function has returned before it is called
//again. one tick is 500ms.
//after any content generator has returned, the bar is updated
//immediately. the return value is an array of formatted text components.
//see the examples for how the format works.
module.exports = {
    default_mode: "info",
    modes: {
        info: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeswitch",
                    modeswitchGoal: "logout",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("Log Out")
                },
                {
                    activatable: true,
                    activateAction: "modeswitch",
                    modeswitchGoal: "wifi",
                    schedule: 20,
                    generator: DefaultGenerators.Wifi("wlp3s0", false)
                },
                {
                    type: "spinner",
                    activatable: true,
                    activateAction: "modeswitchtospinnervalue",
                    modeswitchGoal: "test",
                    schedule: -1,
                    generator: DefaultGenerators.TestSpinner()
                },
                {
                    activatable: false,
                    schedule: 1,
                    generator: DefaultGenerators.DateTime()
                }
            ]
        },
        wifi: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeback",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("Yay, you found the wifi menu!")
                }
            ]
        },
        test1: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeback",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("This is test menu number 1.")
                }
            ]
        },
        test2: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeback",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("This is test menu number 2.")
                }
            ]
        },
        test3: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeback",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("This is test menu number 3 (the adventurous one).")
                }
            ]
        },
        test4: {
            contents: [
                {
                    activatable: true,
                    activateAction: "modeback",
                    schedule: -1,
                    generator: DefaultGenerators.PlainText("This is test menu number 4.")
                }
            ]
        },
        logout: {
            contents: [
                {
                    activatable: true,
                    activateAction: ["exec", "modeback", "leavebarmode"],
                    execCommand: "xfce4-terminal --command=top",
                    generator: DefaultGenerators.PlainText("Top")
                },
                {
                    activatable: true,
                    activateAction: ["exec", "modeback", "leavebarmode"],
                    execCommand: "xfce4-terminal --command=htop",
                    generator: DefaultGenerators.PlainText("Htop")
                },
                {
                    activatable: true,
                    activateAction: ["exec", "modeback", "leavebarmode"],
                    execCommand: "xfce4-taskmanager",
                    generator: DefaultGenerators.PlainText("Task Manager")
                },
                {
                    activatable: true,
                    activateAction: "exec",
                    execCommand: "i3-msg exit",
                    generator: DefaultGenerators.PlainText("End Xorg Session")
                },
                {
                    activatable: true,
                    activateAction: "exec",
                    execCommand: "reboot",
                    generator: DefaultGenerators.PlainText("Reboot")
                },
                {
                    activatable: true,
                    activateAction: "exec",
                    execCommand: "poweroff",
                    generator: DefaultGenerators.PlainText("Shut Down")
                }
            ]
        }
    }
};
