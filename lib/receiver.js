/** A very lightweight implementation of CommonJS Asynchronous Module Definition 
 * (require.def) and 
 * require.ensure. This can only receive modules, it will not proactively attempt to load
 * any modules, so you must leave the default transporter setting of 
 * resolveDeps on (true) to use this module receiver.
 */
(function(){
	var factories = {},
		modules = {};
	function req(id){
		var module = modules[id];
		if(module){
			return module;
		}
		if(!factories[id]){
			throw new Error("Module " + id + " not found");
		}
		var factory = factories[id];
		var args = factory.deps || (factory.length ? ["require", "exports", "module"] : []);
		var exports = modules[id] = {};
		for(var i = 0; i < args.length; i++){
			var arg = args[i]; 
			switch(arg){
				case "require": arg = function(relativeId){
					if(relativeId.charAt(0) === '.'){
						relativeId = id.substring(0, id.lastIndexOf('/') + 1) + relativeId;
						while(lastId !== relativeId){
							var lastId = relativeId;
							relativeId = relativeId.replace(/\/[^\/]*\/\.\.\//,'/');
						}
						relativeId = relativeId.replace(/\/\.\//g,'/');
					}
					return req(relativeId);
				}; break;
				case "exports":  arg = exports; break;
				case "module": var module = arg = {exports: exports}; break;
				default: arg = req(arg);
			}
			args[i] = arg;
		}
		
		exports = factory.apply(this, args);
		if(module && module.exports != modules[id]){
			exports = module.exports;
		}
		if(exports){
			return modules[id] = exports;
		}
		return modules[id];
	}
	define = function(id, deps, factory){
		if(typeof deps == "function"){
			factories[id] = deps;
		}else{
			(factories[id] = factory).deps = deps; 
		}
	};
	
	require = {
		ensure: function(modules, callback){
			for(var i = 0; i < modules.length; i++){
				modules = req(modules[i]);
			}
			callback(req);
		}
	};
})();
