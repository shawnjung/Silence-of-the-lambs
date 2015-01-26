class Lamb extends Backbone.Model
  dive_delay: 1.5
  initialize: (attributes, options)->
    @init_attributes()

  init_attributes: ->
    @set
      x:             Math.random()
      speed_per_sec: (300 - 200) + Math.random()*200
      patience:      _(_.range(7,20)).sample()
      line:          _(_.range(0, 5)).sample()
      direction:     _(['left','right']).sample()
      delay:         Math.random()

  set_owner: (user) ->
    @owner = user
    @set owner_id: user.id

  is_owner: (user) ->
    @owner is user

  start_counter: (options) ->
    delay = @dive_delay
    delay = delay + @get('delay') if options.with_delay

    @_initiation = setTimeout =>
      @renew_counter()
    , delay*1000

  renew_counter: ->
    clearTimeout @_timer if @_timer
    @start_time = new Date().getTime()
    @_timer = setTimeout =>
      @expire()
    , @get('patience')*1000

  expire: ->
    try @collection.room.end_pvp loser: @owner, lamb: this


module.exports = Lamb