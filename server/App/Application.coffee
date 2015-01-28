class Application
  constructor: (options)->
    @io = require('socket.io').listen options.port
    @users = new App.Collection.Users [], model: App.Model.User
    @rooms = new App.Collection.Rooms [], model: App.Model.Room

    @io.sockets.on 'connection', (socket) =>
      user = new App.Model.User id: uuid.v1(), {app: this, socket: socket}
      @users.add user

    setInterval =>
      console.log "Connected users: #{@users.length}, Rooms: #{@rooms.length}"
    ,1000


module.exports = Application