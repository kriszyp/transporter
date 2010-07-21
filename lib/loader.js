/** A very lightweight implementation of transport/D's require.define and
 * require.ensure
 */
(function(){
	var factories = {},
		loadedModules = {};
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
			var module = loadedModules[id];
			if(module){
				return module;
			}
			if(!factories[id]){
				throw new Error("Module " + id + " not defined");
			}
			var module = factories[id](makeRequire(id), loadedModules[id] = {}, {});
			if(module){
				return loadedModules[id] = module;
			}
			return loadedModules[id];
		};
	}
	require = {
		define: function(modules){
			for(var i in modules){
				factories[i] = modules[i];
			}
		},
		ensure: function(modules, callback){
			var require = makeRequire("");
			modules.forEach(require);
			callback(require);
		}
	};
})();
