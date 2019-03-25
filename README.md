# simi3
Status Information and Management for i3

simi3 is a configurable script that supplies content to i3bar.  
The displayed content is interactive and can be controlled via both mouse and keyboard input.  
**Current project state: Alpha. Can not be used productively yet.**

It works by having different modes, one of which is displayed at a time.  
Each mode has multiple sections.  
Each section has a generator and an action.  
A generator is a function that defines the content of the function.


## Setting up with the example configuration
First, integrate the `example-i3-config` file into your i3 configuration.  
That will make sure that your bar displays the status, and also 
configures everything to allow keyboard input.  
You will notice that the settings echo a bunch of words into a file. 
That file is a named pipe, created with `mkfifo(1)`, and is read by simi3.

At the beginning of `simi3.js`, there are a few constants that can 
be changed. Their defaults attempt to read and write files in 
`/home/(username)/`, so you will probably want to change them aswell.  

Once everything is configured, restart i3 to try out the bar.  
You may notice that some fields in the bar only display `"..."`. 
That happens when the dependencies of the generator are not installed.
Either install them (you can find out which they are by looking at
the source code in `default-generators.js`), or use different generators
instead.

## Creating a custom configuration
The configuration of the bar contents is saved in `config.js`.  
The configuration object, which is assigned to `module.exports` in the config
script, has the following features:
 - `default_mode`: name of the mode that should be displayed when simi3 starts
 - `modes`: objects that contains all the modes

A mode object has a `contents` property, which has an array as it's value.
The array contains a series of objects, which each define a section of
the bar, from left to right, like so:
 - `generator`: An `AsyncFunction` that provides the content of the bar
   section. If the generator has not managed to provide any content yet,
   `...` is displayed in the bar.
 - `schedule`: an integer that determines how often the content of the section
   is updated. number is multiplied by 500ms. `-1` means that the generator
   should only be called once.
 - `type`: changes the type of entry in the list. The default value makes the
   entry simply display text. `"spinner"` makes it display two arrows to allow
   rotating through several values.
 - `activatable`: boolean that defines if the section should be able to be
   clicked or activated with the keyboard. (needs to be true for `type: "spinner"`).
 - `activateAction`: if `activatable` is true, one of several pre-defined
   actions, or an array containing multiple of them. Parameters can be supplied
   to the actions by providing additional properties in the section definition.
 - `scrollAction`: only available when `type = "spinner"`. Same as `activateAction`,
   but executes the action(s) when the value of the spinner is changed.

## List of available actions for sections
 - `modeswitch` changes the current mode to the one which is specified in the
   `modeswitchGoal` property of the section.
 - `modeback` goes back to the previously active mode.
 - `exec` executes the value of the `execCommand` property of the section as
   a system command.
 - `leavebarmode` switches the current i3 mode to `default`.
 - `modeswitchtospinnervalue` changes the current mode to the one which is
   specified in the `value` property of the selected spinner value. Requires
   `type: "spinner"` on the section.
 - `execspinnervalue` executes the value of the `value` property of the
   selected spinner value as a system command. Requires `type: "spinner"` on
   the section.
 - `refreshthis` immediately re-runs the generator for the element which
   caused the action.
 - `refreshall` immediately re-runs the generators of all elements in the
   current mode.

## Writing custom generators
Generators are `AsyncFunction`s that are regularly called and 
provide the content of a section of the bar.  
Generators can be defined in `default_generators.js`, but it is recommended
that a separate file is created for custom generators, to keep files 
relatively short which makes it easier to find things.
If a generator is defined in a custom file, it needs to be added to
`simi3.js`, at the location where the generator scripts are loaded into
`global.generators`, and to `config.js`, where they are extracted again.

A generator function can obtain some information from the environment,
or do basically anything it wants, but it should not block execution,
unless it wants to intentionally freeze the bar. Finally, the generator
must return either an array of text component objects that will be displayed
next to each other in the bar for a normal component or an array of spinner
values that can be scrolled through for a spinner.

The text components work as follows:  
Each text component must have a `text` attribute, which contains the text 
that should be displayed on the bar. Additional formatting can be done
with attributes that match those of the 
[Pango Markup](https://developer.gnome.org/pango/stable/PangoMarkupFormat.html)
language, except that underscores followed by a lowercase letter are
replaced by the uppercase variant of the letter, so for example 
`font_weight` becomes `fontWeight`.

The spinner value is an object with the following properties:
 - `value`: A string which represents this value of the spinner. Mainly used
   by the `modeswitchtospinnervalue` and `execspinnervalue` actions.
 - `defaultSelection`: If true, makes the item the default selection of the
   spinner when it is first loaded. If specified on multiple values, the last
   one will be chosen. If not specified on any value, the first one will be
   chosen.
 - `display`: An array of text components which are displayed next to each
   other in the bar when the value is selected.
