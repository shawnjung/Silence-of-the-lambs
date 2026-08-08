path         = require 'path'
require_tree = require 'require-tree'
Http         = require 'http'
Connect      = require 'connect'
Mincer       = require 'mincer'
ServeStatic  = require 'serve-static'
SocketIO     = require 'socket.io'

global.SocketApp = require_tree "#{path.dirname(require.main.filename)}/socket_app"

app = Connect()
http_server = Http.createServer app

# static server
static_server = ServeStatic("./www")

# assets server
Mincer.CoffeeEngine.configure bare: false, literate: false

environment = new Mincer.Environment
environment.appendPath 'client_app/images'
environment.appendPath 'client_app/javascripts'
assets_server = Mincer.createServer environment

# socket_server
socket_app = new SocketApp.Application io: new SocketIO(http_server)

# mount servers
app.use '/', static_server
app.use '/assets', assets_server

console.log("starting the server with port: " + process.env.PORT)
http_server.listen process.env.PORT or 3000
