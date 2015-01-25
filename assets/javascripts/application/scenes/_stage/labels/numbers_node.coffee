class App.Scenes.Stage.Labels.NumbersNode extends cc.Node
  constructor: (options = {})->
    super
    @update options.numbers, options

  update: (numbers, options = {}) ->
    @clear()
    number_array = _(numbers.toString()).toArray()

    @number_nodes = []
    @align = options.align or @align or 'left'

    switch @align
      when 'right'
        @setAnchorPoint 1, 0
        @start_point  = number_array.length*-70
      when 'left'
        @setAnchorPoint 0, 0
        @start_point  = 0
      when 'center'
        @setAnchorPoint 0.5, 0
        @start_point  = number_array.length*-70/2+10



    _(number_array).each (number, index) =>
      number_node = @_render_number number, index
      @number_nodes.push number_node
      @addChild number_node

  clear: ->
    @removeAllChildrenWithCleanup(true)

  setOpacity: (opacity) ->
    _(@number_nodes).each (node) ->
      node.setOpacity opacity


  _render_number: (number, index) ->
    sprite_index = parseInt(number)*80
    output = new cc.Sprite res.stage.labels.numbers, new cc.Rect(sprite_index,0,80,150);
    output.setAnchorPoint 0, 0
    output.attr x: @start_point+index*70
    output

  fade_in_then_out: (raw_callback) ->
    fade_in_animation = cc.spawn cc.fadeIn(0.3), cc.moveBy 0.3, cc.p(0, 80)
    fade_out_animation = cc.spawn cc.fadeOut(0.3), cc.moveBy 0.3, cc.p(0, 80)
    callback = new cc.CallFunc -> raw_callback()

    _(@number_nodes).each (node) ->
      node.setOpacity 0
      node.runAction cc.sequence  fade_in_animation.clone(),
                                  fade_out_animation.clone(),
                                  callback
