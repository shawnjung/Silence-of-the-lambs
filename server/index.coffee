args        = process.argv.splice(2)

global.path     = require('path')
global.uuid     = require 'node-uuid'
global._        = require 'underscore'
global.Backbone = require 'backbone'
require_tree    = require 'require-tree'

global.App = require_tree path.dirname(require.main.filename)+"/app"
global.SOTLServer = App

new SOTLServer.Application port: parseInt(args[0])