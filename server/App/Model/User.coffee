class User extends Backbone.Model
  initialize: (attributes, options) ->
    @app    = options.app
    @socket = options.socket

    @socket.emit 'connected', user_id: @id

    @_bind_events @socket

  events:
    'create-room': 'create_room'
    'join-room': 'join_room'
    'touch-lamb': 'update_lamb'
    'leave-room': 'leave_room'
    'restart-pvp': 'restart_pvp'

    'disconnect': 'disconnect'


  create_room: ->
    @leave_room() if @room

    room = @app.rooms.add id: @app.rooms.create_id()
    room.init_data()
    room.set_player this

    @socket.emit 'room-created', room_id: room.id


  join_room: (socket, params) ->
    room = @app.rooms.get(params.room_id)
    if not room or room.is_full()
      @socket.emit 'invalid-room'
    else
      @room.unset_player this if @room
      room.set_player this
      room.start_pvp()


  leave_room: ->
    @room.end_pvp loser: this if @room.active
    @room.unset_player this


  restart_pvp: ->
    if @room.is_full()
      @room.start_pvp()
    else
      @socket.emit 'left-player'


  update_lamb: (socket, params) ->
    # @room is defined when room set player
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
    @leave_room() if @room
    @destroy()


  destroy: ->
    @collection.remove this



  _bind_events: (socket)->
    _(@events).each (method_name, event_name) =>
      socket.on event_name, (params) =>
        @trigger event_name, socket,  params

      @on event_name, @[method_name], this

module.exports = User