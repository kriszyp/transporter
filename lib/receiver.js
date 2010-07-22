/** A very lightweight implementation of transport/D's require.define and 
 * require.ensure. This can only receive modules, it will not proactively attempt to load
 * any modules, so you must not turn off the default transporter setting of 
 * resolveDeps to use this module receiver.
 */
(function(){
	var factories = {},
		modules = {};
	function makeRequire(currentId){
		return function(id){
			if(id.charAt(0) === '.'){
				id = currentId.substring(0, currentId.lastIndexOf('/') + 1) + id;
				while(lastId !== id){
					var lastId = id;
					id = id.replace(/\/[^\/]*\/\.\.\//,'/');
				}
				id = id.replace(/\/\.\//g,'/');
			}
			var module = modules[id];
			if(module){
				return module;
			}
			if(!factories[id]){
				throw new Error("Module " + id + " not found");
			}
			var module = factories[id](makeRequire(id), modules[id] = {}, {});
			if(module){
				return modules[id] = module;
			}
			return modules[id];
		};
	}
	require = {
		define: function(modules){
			for(var i in modules){
				factories[i] = modules[i];
				if(typeof factories[i] != "function"){
					throw new Error("Module " + id + " must be defined as a function");
				}			
			}
		},
		ensure: function(modules, callback){
			var require = makeRequire("");
			modules.forEach(require);
			callback(require);
		}
	};
})();
