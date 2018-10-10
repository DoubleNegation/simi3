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
The configuration object, which is assigned to `module.exports` in the config script, has the following features:
 - `default_mode`: name of the mode that should be displayed when simi3 starts
 - `modes`: objects that contains all the modes

A mode object has a `contents` property, which has an array as it's value. The array contains a series of objects, which each define a section of the bar, from left to right, like so:
 - `generator`: An `AsyncFunction` that provides the content of the bar section. If the generator has not managed to provide any content yet, `...` is displayed in the bar.
 - `schedule`: an integer that determines how often the content of the section is updated. number is multiplied by 500ms. `-1` means that the generator should only be called once.
 - `activatable`: boolean that defines if the section should be able to be clicked or activated with the keyboard.
 - `activateAction`: if `activatable` is true, one of several pre-defined actions. Parameters can be supplied to the actions by providing additional properties in the section definition.

## List of available actions for sections
_TODO: write this once there are more actions_

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
must return an array of text component objects that will be displayed in
the bar.

The text components work as follows:  
Each text component must have a `text` attribute, which contains the text 
that should be displayed on the bar. Additional formatting can be done
with attributes that match those of the 
[Pango Markup](https://developer.gnome.org/pango/stable/PangoMarkupFormat.html)
language, except that underscores followed by a lowercase letter are
replaced by the uppercase variant of the letter, so for example 
`font_weight` becomes `fontWeight`.
