require("supervisor").run(['-w', __dirname, '-e', 'coffee,js', 'coffee', __dirname + "/index.coffee"])
