//TODO: optionally write to target file

exports = module.exports ? Transporter : exports;
exports.Transporter = Transporter;
function Transporter(options, app) {
	var options = options || {},
		prefix = options.urlPrefix || "/lib/",
		resolveDeps = "resolveDeps" in options ? options.resolveDeps : true,
		excludeModules = options.excludeModules || ["require", "yabble", "transportD"],
		paths = options.paths || require.paths.map(function(path){
			return path.replace(/[\\\/]engines[\\\/](\w*)/,function(t, engine){
				return "/engines/" + (engine === "default" ? "default" : "browser");
			});
		}),
		loader = options.loader || function(id){
			var FS = require("fs"),
			    PATH = require("path");
			for (var i = 0; i < paths.length; i++){
				var path = PATH.join(paths[i], id);
				if(PATH.existsSync(path)){
					return FS.readFileSync(path, "ascii");
				}
			}
		},
		autoRun = options.autoRun !== false,
		excluded = {};
		converter = options.converter || exports.CommonJS;

	excludeModules.forEach(function(moduleId){
		excluded[moduleId] = true;
	});
	return function(request) {
		var modules, path = request.pathInfo;
		if(path.indexOf(prefix) != 0){
			if(app){
				return app(request);
			}
			return {
				status: 404,
				headers: {},
				body: ["Not found"]
			};
		}
		var errors = [],
			requestedModules = path.substring(prefix.length, path.length)
			.split(',').map(function(module){
				if(module.substring(module.length - 3, module.length) == ".js"){
					return module.substring(0, module.length - 3); // strip the .js
				}
				return module;
			});
		if(loader(requestedModules[0] + ".js")){
			modules = {};
			return {
				status: 200,
				headers: {
					"Content-Type": "application/javascript"
				},
				body: {
					forEach: function(write){
						if(requestedModules[0] === "transporter/receiver"){
							write(loader("transporter/receiver.js"));
							requestedModules.shift();
						}
						if(converter.start){
							converter.start(write);
						}
						requestedModules.filter(function(module){
							if(module.charAt(0) === "-"){
								module = module.substring(1);
								// find all the module and deps treat them as already loaded
								loadModule(module);
								return;
							}
							return true;
						}).forEach(function(module){
							if(module){
								loadModule(module, write);
							}
						});
						if(converter.end){
							converter.end(write);
						}
						errors.forEach(write);
						if(requestedModules.length > 1){
							write('define("' + requestedModules.join(",") + '", [], function(){});');
						}
						if(autoRun && requestedModules.length){
							write('require.ensure&&require.ensure(["' + requestedModules.join(",") + '"], function(require){' +
								requestedModules.map(function(module){
									return 'require("' + module + '");';
								}) +
							'});');
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
		function loadModule(moduleName, write){
			if(modules[moduleName]){
				return true;
			}
			modules[moduleName] = 1; // in progress
			try{
				var fileContents = loader(moduleName + ".js");
			}
			catch(e){
				errors.push("/* Warning: " + (moduleName + " could not be loaded: " + e.message).replace(/\*/g,"") + "*/");
				return;
			}
			if(!fileContents && write){
				errors.push("/* Warning: " + (moduleName + " not found").replace(/\*/g,"") + "*/");
				return;
			}
			if(moduleName === "transporter/loader"){
				write(fileContents);
				return true;
			}
			if(moduleName === "require"){
				// require.js loads the require handler, which can't be embedded in
				// require.def because require doesn't exist yet
				// also hand-coded modules that define their require.def's don't need wrapping/resolution,
				// they can be directly written
				var baseUrl = request.pathInfo.substring(0, request.pathInfo.lastIndexOf("/") + 1);
				// we set the base url in the require config so that it knows where to load from
				write('require={baseUrlMatch:RegExp("' + requestedModules[0] + '")};');
				write(fileContents);
				return true;
			}
			if(excluded[moduleName]){
				write(fileContents);
				return true;
			}
			converter(moduleName, fileContents, resolveDeps ? loadModule : function(){ return true;}, modules, write);
			modules[moduleName] = 2; // finished
			return true;
		}
	}
}

var depNames = {};
var fulfilledDeps = {};
var deps = [];
// CommonJS module wrapper
exports.CommonJSTransportD = function(moduleName, fileContents, loadModule, modules, write){
	fulfilledDeps[moduleName] = true;
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
				moduleId = (baseModule + moduleId).replace(/\.\//g,'');
			}
		}
		if(depNames[moduleId]){
			return;
		}
		depNames[moduleId] = true;
		deps.push(moduleId);
		if(!loadModule(moduleId, write)){
			deps.splice(deps.indexOf(moduleId), 1);
		}
	});
	if(write){
		if(first){
			first = false;
		}else{
			write(",\n");
		}
		write('"' + moduleName);
		write('":function(require, exports, module) {');
		write(fileContents);
		write('\n}');
	}
};
var first;
exports.CommonJSTransportD.start = function(write){
	first = true;
	fulfilledDeps = {};
	deps = [];
	depNames = {};
	write('require.define({\n');
	first = true;
};
exports.CommonJSTransportD.end = function(write){
	write('\n},[')
	deps = deps.filter(function(dep){
		return !fulfilledDeps[dep];
	});
	write((deps.length ? '"' + deps.join('", "') + '"' : '') + ']);');
};
// CommonJS module wrapper
exports.CommonJS = function(moduleName, fileContents, loadModule, modules, write){
	var deps = [];
	var depNames = {};
	var baseModule = moduleName.substring(0, moduleName.lastIndexOf("/") + 1);
	var needsStaticAnalysis = true;
	var firstRequireDef = fileContents.indexOf("define(");
	if(firstRequireDef > -1){ 
		// in AMD form
		fileContents = fileContents.replace(/define\(\s*(?:['"]([^'"]*)['"]\s*,)?\s*(?:(\[[^\]]*\]\s*),)?/,function(t, id, depsJson){
			if(depsJson){
				JSON.parse(depsJson).forEach(onDependency);
			}else if(!id){
				// anonymous, no deps, should use static analysis
				staticAnalysis();
			}
			deps = deps.filter(function(dep){
				return !fulfilledDeps[dep];
			});
			// TODO: Once there is a good support for optional dependencies, hopefully we can check the deps.length and omit the deps if there are none
			if(!depsJson && !id){// && deps.length){
				deps = ["require", "exports", "module"].concat(deps);
			}
			return 'define("' + moduleName + '",' + (deps.length ? '["' + deps.join('", "') + '"],' : ''); 
		});
	}else{
		staticAnalysis();
		deps = deps.filter(function(dep){
			return !fulfilledDeps[dep];
		});
	}
	function staticAnalysis(){
		fileContents.replace(/require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){
			onDependency(moduleId);
		});
	}
	function onDependency(moduleId){
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
				moduleId = (baseModule + moduleId).replace(/\.\//g,'');
			}
		}
		if(depNames[moduleId]){
			return;
		}
		depNames[moduleId] = true;
		deps.push(moduleId);
		if(!loadModule(moduleId, write)){
			deps.splice(deps.indexOf(moduleId), 1);
		}
	}
	if(write){
		if(firstRequireDef == -1){
			write('define("');
			write(moduleName);
			write('", ["require", "exports", "module"');
			write((deps.length ? ', "' + deps.join('", "') + '"' : '') + '], ');
			write('function(require, exports, module) {');
			write(fileContents);
			write('\n});\n');
		}else{
			// already in AMD form
			write(fileContents);
			write('\n');
		}
	}
};


// Dojo module wrapper
exports.Dojo = function(moduleName, fileContents, loadModule, modules, write){
	var deps = [];
	var depNames = {};
	var baseModule = moduleName.substring(0, moduleName.lastIndexOf("/") + 1);
	fileContents.replace(/dojo\.require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){
		moduleId = moduleId.replace(/\./g,'/');
		if(depNames[moduleId]){
			return;
		}
		depNames[moduleId] = true;
		if(!loadModule(moduleId, write)){
			deps.splice(deps.indexOf(moduleId), 1);
		}
		loadModule(moduleId, write);
	});
	if(write){
		write(fileContents);
	}
};

// Dojo module wrapper
exports.DojoRequireJS = function(moduleName, fileContents, loadModule, modules, write){
	var deps = [];
	var depNames = {};
	var baseModule = moduleName.substring(0, moduleName.lastIndexOf("/") + 1);
	fileContents.replace(/dojo\.require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){
		moduleId = moduleId.replace(/\./g,'/');
		if(depNames[moduleId]){
			return;
		}
		depNames[moduleId] = true;
		deps.push(moduleId);
		if(!loadModule(moduleId, write)){
			deps.splice(deps.indexOf(moduleId), 1);
		}
	});
	if(write){
		write('define("');
		write(moduleName);
		write('", [');
		write((deps.length ? '"' + deps.join('", "') + '"' : '') + '], ');
		write('function() {');
		write(fileContents);
		write('\n});\n');
	}
};
module.exports = exports;