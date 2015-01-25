class User extends Backbone.Model
  initialize: (attributes, options) ->
    @app    = options.app
    @socket = options.socket

    @_bind_events @socket

  events:
    'ping': 'pong'
    'create-room': 'create_room'
    'join-room': 'join_room'
    'disconnect': 'disconnect'


  pong: ->
    @socket.emit 'pong'


  create_room: ->
    room = @app.rooms.add id: @app.rooms.create_id()
    room.init_data()
    room.set_player this, as: 0


    @socket.emit 'room-created', room_id: room.id


  join_room: (socket, params) ->
    room = @app.rooms.get(params.room_id)
    if not room or room.is_full()
      @socket.emit 'invalid-room'
    else
      room.set_player this, as: 1
      room.start_pvp()




  disconnect: ->
    @collection.remove this






  _bind_events: (socket)->
    _(@events).each (method_name, event_name) =>
      if @[method_name]
        method = _.bind @[method_name], this
        socket.on event_name, (params) => method socket, params

module.exports = User