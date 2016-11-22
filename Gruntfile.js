module.exports = function(grunt) {
	require("time-grunt")(grunt);
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		eslint: {
			options: {
				configFile: ".eslintrc.json"
			},
			target: ["*.js"]
		},
		stylelint: {
			simple: {
				options: {
					configFile: ".stylelintrc"
				},
				src: ["*.css"]
			}
		},
		jsonlint: {
			main: {
				src: ["package.json", ".eslintrc.json", ".stylelint"],
				options: {
					reporter: "jshint"
				}
			}
		},
		markdownlint: {
			all: {
				options: {
					config: {
						"default": true,
						"MD033": false,
					}
				},
				src: ["*.md"]
			}
		},
		yamllint: {
			all: [".travis.yml"]
		}
	});
	grunt.loadNpmTasks("grunt-eslint");
	grunt.loadNpmTasks("grunt-stylelint");
	grunt.loadNpmTasks("grunt-jsonlint");
	grunt.loadNpmTasks("grunt-markdownlint");
	grunt.registerTask("default", ["eslint", "stylelint", "jsonlint", "markdownlint"]);
};
