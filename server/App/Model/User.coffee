class User extends Backbone.Model
  initialize: (attributes, options) ->
    @app    = options.app
    @socket = options.socket

    @_bind_events @socket

  events:
    'ping': 'pong'
    'create-room': 'create_room'
    'disconnect': 'disconnect'


  pong: ->
    @socket.emit 'pong'


  create_room: ->
    @socket.emit 'room-created', room_id: @app.rooms.create_id()


  disconnect: ->
    @collection.remove this






  _bind_events: (socket)->
    _(@events).each (method_name, event_name) =>
      if @[method_name]
        method = _.bind @[method_name], this
        socket.on event_name, (params) => method socket, params

module.exports = User