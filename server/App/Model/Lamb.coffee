class Lamb extends Backbone.Model
  initialize: (attributes, options)->
    @init_attributes()

  init_attributes: ->
    @set
      speed_per_sec: (300 - 200) + Math.random()*200
      patience:      _(_.range(7,20)).sample()
      line:          _(_.range(0, 5)).sample()
      direction:     _(['left','right']).sample()
      delay:         1*Math.random()

  set_owner: (user, index) ->
    @owner = user
    @set owner_id: user.id

module.exports = Lamb