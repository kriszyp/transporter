var file = require("file");

exports.Transporter = function(app, options) {
    var options = options || {},
        prefix = options.urlPrefix || "/lib/",
        paths = options.paths || require.paths.map(function(path){
        	return path.replace(/[\\\/]engines[\\\/](\w*)/,function(t, engine){
        		return "/engines/" + (engine === "default" ? "default" : "browser");
        	});
        });
    
    return function(request) {
    	var modules, isPaused, path = request.pathInfo;
		if(path.indexOf(prefix) != 0){
			if(app){    
				return app(request);
			}
			return {
	            status: 404,
	            headers: {
	            	"Content-Type": "application/javascript"
	            },
	            body: ["Not found"]
	        };
		}
		var requestedModules = path.substring(prefix.length, path.length)
			.split(',').map(function(module){
				if(module.substring(module.length - 3, module.length) == ".js"){
					return module.substring(0, module.length - 3); // strip the .js
				}
				return module;
			});
		if(findPath(requestedModules[0] + ".js")){
			requestedModules = requestedModules;
			
	        modules = {};
	        return {
	        	status: 200,
	        	headers: {},
	        	body: {
	        		forEach: function(write){
        				requestedModules.filter(function(module){
							if(module.charAt(0) === "-"){
								module = module.substring(1);
								// find all the module and deps treat them as already loaded
								load(module);
								return;
							}
							return true;
        				}).forEach(function(module){
							if(module){
	        					load(module, write);
							}
        				});
        				if(isPaused){
	        				write("require.resume();\n");
        				}
        				if(requestedModules.length > 1){
        					write('require.def("' + requestedModules.join(",") + '", [], function(){});');
        				}
	        		}
	        	}
	        };
		}
		// couldn't find the path
        return {
            status: 404,
            headers: {},
            body: ["Not found"]
        };
        function findPath(moduleName){
	        for (var i = 0; i < paths.length; i++){
	        	var path = file.join(paths[i], moduleName);
				if(file.isFile(path)){
					return path;
				}
	        }
        }
        function load(moduleName, write){
        	if(modules[moduleName]){
        		if(modules[moduleName] === 1 && !isPaused && write){
        			// we need to pause to get all the dependencies loaded
	       			write("require.pause();\n");
        			isPaused = true;
        		}
        		return;
        	}
        	modules[moduleName] = 1; // in progress
        	var path = findPath(moduleName + ".js");
        	if(!path && write){
        		debugger;
        		write('console.error(' + JSON.stringify(moduleName) + ' + " not found");\n');
        		return;
        	}
	        var fileContents = file.read(path);
	        if(moduleName === "require"){
	        	// require.js loads the require handler, which can't be embedded in 
	        	// require.def because require doesn't exist yet
	        	var baseUrl = request.pathInfo.substring(0, request.pathInfo.lastIndexOf("/") + 1);
	        	// we set the base url in the require config so that it knows where to load from
	        	write('require={baseUrl:"' + baseUrl + '"};');
	        	write(fileContents);
	        	return;
	        }
	        var deps = [];
	        var depNames = {};
	        var baseModule = moduleName.substring(0, moduleName.lastIndexOf("/") + 1);
	        fileContents.replace(/require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){

                // handle relative references
                if(moduleId.charAt(0) == "."){
                    if(moduleId.charAt(1) == "."){
                        var baseModuleParts = baseModule.split("/");
                        baseModuleParts.pop();  // remove trailing slash
                        var moduleIdParts = moduleId.split("/");
                        for( var i=0 ; i<moduleIdParts.length ; i++ ) {
                            if(moduleIdParts[i]=="..") {
                                baseModuleParts.pop();
                                moduleIdParts.splice(i,1);
                                i--;
                            } else {
                                break;
                            }
                        }
                        moduleId = (baseModuleParts.concat(moduleIdParts).join("/"));
                    } else {
                        moduleId = (baseModule + moduleId).replace(/\/\.\.\/[^\/]*/g,'').replace(/\.\//g,'');
                    }
	        	}

	        	if(depNames[moduleId]){
	        		return;
	        	}
	        	depNames[moduleId] = true;
	        	deps.push(moduleId);
	        	load(moduleId, write);
	        });
        	modules[moduleName] = 2; // finished
	        if(write){
		        write('require.def("');
		        write(moduleName);
		        write('", ["require", "exports", "module"');
		        write((deps.length ? ', "' + deps.join('", "') + '"' : '') + '], ');
				write('function(require, exports, module) {\n');
	            write(fileContents);
	            write('\n});\n');
	    	}
        }
    }
}
