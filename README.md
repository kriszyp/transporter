Transporter is a JSGI appliance that serves modules to the browser with dependencies 
included and packaged in the CommonJS module transport format:

[http://wiki.commonjs.org/wiki/Modules/Transport/D](http://wiki.commonjs.org/wiki/Modules/Transport/D)

This format permits asynchronous loading of modules and combining multiple modules 
(modules with their dependencies) into single responses. Transporter should work
with any client side module loader that supports the CommonJS module transport
format. This has been primarily tested with RequireJS and Yabble:   

[http://github.com/jrburke/requirejs](http://github.com/jrburke/requirejs)
[http://github.com/jbrantly/yabble](http://github.com/jbrantly/yabble)

To use transporter, include the appliance in your JSGI stack:

    var Transporter = require("transporter").Transporter;
    exports.app = Transporter();

Now you can use a client side module loader like RequireJS, Yabble, or the simple loader
that comes with transporter to load your modules:

    <script src="transporter/receiver.js"></script>
    <script src="my-module.js"></script>

If my-module.js requires other modules (using a require call), these modules will
automatically be included in the request for my-module.js (multiple requests are not
needed). This is all that needs to be done to load CommonJS modules. With this
mechanism, the easiest way to included a set of modules is to create a module that
requires all of them, and load it with a script tag.
    
We can also specify a set of modules with the path we provide to the script tag. The
module names can be comma separated:

    <script src="transportD-require.js,module-a.js,module-b.js"></script>

Dependency Control
------------------

There may be situations where you want a certain module (or set of modules) is used
on several pages, but other modules are unique to that page. In such situations it can
be advantageous to two separate script requests, so that one script request/response can be 
cached for later visits to other pages that will reuse that set of modules, and another 
script request can be used for page-specific modules. This can also be using transporter's
negation syntax. If a module name is prefixed with a dash, this will indicate that the
module and it's dependencies have already been loaded and should not be included
in the given response. For example: 

    <script src="shared.js"></script>
    <script src="page-a-module.js,-shared.js"></script>
    
RequireJS provides additional facilities for asynchronously loading of modules 
which can be very useful for loading modules on demand. 

Configuring Transporter
----------------------

The Transporter appliance can also be configured to support different scenarios. 
The first parameter is the options, which can have several properties (they are all optional):

* url - The URL path prefix for all the javascript libraries that will be processed by the Transporter. This defaults to "/lib/".
* loader - A function to be called to load a module. This is called with a module id and 
should return the source of the module. If you are using nodules, you can
conveniently reuse the current package and mapping configuration with the browser,
(and utilize the browser overlay for browser-specific modules):

    loader: require("nodules").forEngine("browser").useLocal().getModuleSource,
    
* resolveDeps - A boolean that indicates whether the dependencies of a module should be included
in the response to the client (or if the client should request each dependency). This defaults
to true.
* autoRun - A boolean indicating whether the module should automatically be executed
on the browser. Defaults to true.
* converter - You can specify alternate wrapping mechanisms with the converter
property. The value of converter can be one of the converters exported by the 
transporter module:
** CommonJS - CommonJS module transport format (Transport/D). This is the default.
** CommonJSTransportC - CommonJS module Transport/C.
** Dojo - For Dojo modules
** DojoRequireJS - For Dojo modules with use with RequireJS
For example:

    converter: require("transporter/jsgi/transporter").CommonJSTransportC,
    
* paths - The set of paths to lookup modules in. The defaults to require.paths set of 
paths where any /engines/some-engine paths replaced with a /engines/browser path.
This is only be used if no "loader" property is provided. 

The second parameter is next JSGI application, so Transporter can be used as middleware.

For example:

    require("transporter").Transporter({
        url:"/js/", 
        paths: ["/some/path"]
    }, nextApp);
    
Using RequireJS
----------------

You can use require.js to load your modules (of 
course you should actually download transportD-require.js for local access):

    <script>
        // Configure RequireJS
        require = {baseUrl: "lib/"};
    </script>
    <script src="http://requirejs.org/docs/release/0.11.0/minified/transportD-require.js"></script>
    <script src="my-module.js"></script>

Using Yabble
------------

Using and configuring Yabble looks something like this (once again, you should use your
own copy):

    <script src="http://github.com/jbrantly/yabble/raw/master/lib/yabble.js"></script>
    <script>
        // Configure Yabble
        require.setModuleRoot("lib/");
        require.useScriptTags();
    </script>
    <script src="lib/my-module.js"></script>

Including Module Loader
-----------------------

If two requests for modules (one for the module loader and one for the actual module) 
is too many, we can actually include require.js or yabble.js in our module. For example:

    my-module.js:
    
    require("require"); // this will cause require.js to be included
    require("module-a");
    require("module-b");
    
Now we can simply include a single script tag, and require.js, module-a.js, and 
module-b.js (and any dependencies they have) will be included in the response for
my-module.js.