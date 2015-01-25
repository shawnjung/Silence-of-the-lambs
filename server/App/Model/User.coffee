class User extends Backbone.Model
  initialize: (attributes, options) ->
    @app    = options.app
    @socket = options.socket

    @socket.emit 'connected', user_id: @id

    @_bind_events @socket

  events:
    'ping': 'pong'
    'create-room': 'create_room'
    'join-room': 'join_room'
    'touch-lamb': 'update_lamb'
    'left-room': 'left_room'
    'restart-pvp': 'restart_pvp'

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


  left_room: ->
    @room.end_pvp loser: this, lamb: @room.lambs.first()
    @room.left_user this


  restart_pvp: ->
    if @room.is_full()
      @room.start_pvp()
    else
      @socket.emit 'left-player'

  update_lamb: (socket, params) ->
    # @room is defined when the room starts pvp
    if lamb = @room.lambs.get params.id
      if lamb.is_owner this
        start_time = lamb.start_time
        patience_was = lamb.get 'patience'
        new_patience = _(_.range(7,20)).sample()
        lamb.set 'patience', new_patience
        @room.emit_each 'reset-lamb', id: lamb.id, patience: new_patience
        lamb.renew_counter()

        end_time = new Date().getTime()
        rest_second = patience_was - (end_time - start_time) / 1000
        @room.add_lamb by: this if rest_second < patience_was/8

      else
        @room.end_pvp loser: this, lamb: lamb

  disconnect: ->
    @left_room() if @room
    @collection.remove this



  _bind_events: (socket)->
    _(@events).each (method_name, event_name) =>
      if @[method_name]
        method = _.bind @[method_name], this
        socket.on event_name, (params) => method socket, params

module.exports = User