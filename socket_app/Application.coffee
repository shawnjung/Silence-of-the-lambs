global.uuid     = require 'node-uuid'
global._        = require 'underscore'
global.Backbone = require 'backbone'

class Application
  constructor: (options)->
    {@io} = options
    @users = new SocketApp.Collection.Users [], model: SocketApp.Model.User
    @rooms = new SocketApp.Collection.Rooms [], model: SocketApp.Model.Room

    @io.sockets.on 'connection', (socket) =>
      user = new SocketApp.Model.User id: uuid.v1(), {app: this, socket: socket}
      @users.add user


module.exports = Application