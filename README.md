Transporter is JSGI application that serves modules to the browser with dependencies 
included and packaged in the CommonJS module transport format:
http://wiki.commonjs.org/wiki/Modules/Transport/C
This format permits asynchronous loading of modules and combining multiple modules 
(modules with their dependencies) into single responses. Transporter should work
with any client side module loader that supports the CommonJS module transport
format. This has been primarily tested with RequireJS (and require.js from this project
is included):   
http://github.com/jrburke/requirejs

To use transporter, include the appliance in your JSGI stack:

    jackconfig.js:
    var Transporter = require("transporter").Transporter;
    exports.app = Transporter();

Now you can use a client side module loader like require.js to load your modules:

    <script src="require.js"></script>
    <script src="my-module.js"></script>

If my-module.js requires other modules (using a require call), these modules will
automatically be included in the request for my-module.js (multiple requests are not
needed). This is all that needs to be done to load CommonJS modules. With this
mechanism, the easiest way to included a set of modules is to create a module that
requires all of them, and load it with a script tag.

If two requests for modules is too many, we can actually include require.js in our 
module. For example:

    my-module.js:
    
    require("require"); // this will cause require.js to be included
    require("module-a");
    require("module-b");
    
Now we can simply include a single script tag, and require.js, module-a.js, and 
module-b.js (and any dependencies they have) will be included in the response for
my-module.js.

    <script src="my-module.js"></script>
    
We can also specify a set of modules with the path we provide to the script tag. The
module names can be comma separated:

	<script src="require.js,module-a.js,module-b.js"></script>

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
	
require.js provides 

The Transporter appliance can also be configured to support different scenarios. The 
first parameter is next JSGI application, so Transporter can be used as middleware.
The second parameter is the options, which can have two properties:

* url - The URL path prefix for all the javascript libraries that will be processed by the Transporter. This defaults to "/lib/".
* paths - The set of paths to lookup modules in. The defaults to require.paths set of paths where any /engines/some-engine paths replaced with a /engines/browser path. 

    require("transporter").Transporter(nextApp, {
    	url:"/js/", 
    	paths: ["/some/path"]
    });
	