class App.Scenes.Stage.BaseScene extends App.Scene
  lambs_count: 5
  patience_levels: _.range(7,20)
  current_score: 0
  y_lines: [0, 100, 200, 280, 360, 440]

  constructor: ->
    super
    @size = cc.winSize
    @lines = [[],[],[],[],[],[]]
    @lambs = []


  zoom_lamb: (lamb, callback) ->
    window.last_lamb = lamb
    lamb_position = lamb.getPosition()
    lamb_size     = lamb.getContentSize()
    scale         = 1.6 + 4*(1 - lamb.lamb_node.getScaleY()*2)
    @elements.setAnchorPoint (lamb_position.x/@size.width), (lamb_position.y/@size.height)
    reposition = @elements.getAnchorPointInPoints()
    @elements.setPosition reposition.x, reposition.y
    x = reposition.x - (reposition.x - @size.width/2)
    y = reposition.y - (reposition.y - @size.height/2)-lamb_size.height

    @elements.runAction cc.sequence cc.spawn(cc.EaseIn.create(cc.moveTo(0.4, cc.p(x, y)), 5) , cc.EaseIn.create(cc.scaleTo(0.4, scale), 5)),
                            new cc.CallFunc -> callback()


  stop_all_lambs: ->
    _(@lambs).each (lamb) -> lamb.stop()


  _render_game_elements: ->
    @elements = new cc.Node
    @elements.size = @size
    @elements.attr width: @size.width, height: @size.height
    @elements.setAnchorPoint 0, 0

    @_render_background()
    @addChild @elements

  _render_background: ->
    @background = new App.Scenes.Stage.BackgroundNode
    @elements.addChild @background, 0

  _render_lambs: ->
    _(_.range(0, @lambs_count)).each =>
      @render_lamb @_attributes_for_random_lamb()

  render_lamb: (options)->
    @lines[options.line].push 1
    x = parseInt(@size.width * options.x)
    y = @y_lines[options.line]+20 + @lines[options.line].length*15

    lamb = new @lamb_controller
      scale: 0.5-(y/@size.height*0.45), x: x, y: y
      patience: options.patience, direction: options.direction
      speed_per_sec: options.speed_per_sec, opacity: 0
      skin: options.skin, stage: this

    @touchables.push lamb
    @lambs.push lamb

    @runAction cc.sequence new cc.DelayTime(options.delay), new cc.CallFunc =>
      @elements.addChild lamb, 640+(y*-1)
      lamb.dive => lamb.start()

    lamb


  _attributes_for_random_lamb: ->
    x:             Math.random()
    line:          _(_.range(0, 5)).sample()
    patience:      _(@patience_levels).sample()
    direction:     _(['left', 'right']).sample()
    speed_per_sec: (300 - 200) + Math.random()*200
    delay:         Math.random()