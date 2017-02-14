class App.Scenes.Stage.LambController extends cc.Node
  speed_per_sec: 180
  speaking: false
  walking:  false
  moving:   false
  active:   true
  direction: 'right'
  skins:
    mine: res.stage.lamb
    enermy: res.stage.enermy_lamb

  constructor: (options)->
    super
    @stage = options.stage
    @skin  = options.skin or 'mine'
    @setAnchorPoint 0.5, 0
    @options = options or {}

    @patience      = options.patience
    @speed_per_sec = options.speed_per_sec

    @lamb_node = new App.Scenes.Stage.LambNode skin: @skins[@skin]
    @gauge_node = new App.Scenes.Stage.GaugeNode skin: @skins[@skin]

    @addChild @lamb_node, 1
    @addChild @gauge_node, 2

    @main_node = @lamb_node

    @on 'time-over', => @stage.trigger 'time-over', this

  events: {}


  onEnter: ->
    @_set_scale()
    @_set_position()
    @lamb_node.attr y: 700
    @hide_gauge()
    super


  start: ->
    if @active
      @gauge_node.runAction cc.sequence cc.show()
      @gauge_node.start()
      @move_around 0, @stage.size.width
      @_start_time = new Date().getTime()

  stop: ->
    @active = false
    @moving = false
    @walking = false
    @stopAllActions()
    @lamb_node.stop()
    @gauge_node.stop()
    @hide_gauge()

  show_gauge: ->
    @gauge_node.runAction cc.show()

  hide_gauge: ->
    @gauge_node.runAction cc.hide()

  reset: (options) ->
    @_start_time = new Date().getTime()
    @patience = options.patience
    @gauge_node.reset()


  _render_score_overlay: (score) ->
    size = @getContentSize()
    score_label = new App.Scenes.Stage.Labels.NumbersNode numbers: score, align: 'center'
    scale = 0.2
    scale = 0.3 if score > 15
    scale = 0.5 if score > 30
    score_label.attr x: size.width/2, y: size.height, scale: scale
    score_label.fade_in_then_out => @removeChild score_label, true
    @addChild score_label, 20



  move: (distance) ->
    @stopAction @moving if @moving

    seconds = distance/@speed_per_sec
    stand = new cc.CallFunc => @stand()

    @moving = cc.sequence cc.moveBy(seconds, cc.p(distance, 0)), stand
    @runAction @moving

  move_around: (from, to) ->
    return false if @moving

    position = @getPosition()

    from = @minimum if from < @minimum
    to   = @maximum if to > @maximum
    distance = to - from
    seconds  = distance/@speed_per_sec

    around_animation  = cc.sequence @_turn_to_left(),
                                    cc.moveTo(seconds, cc.p(from, position.y)),
                                    @_turn_to_right(),
                                    cc.moveTo(seconds, cc.p(to, position.y))

    after_init_animation = new cc.CallFunc =>
      @runAction new cc.RepeatForever around_animation


    switch @direction
      when 'right'
        to_distance     = to - position.x
        init_animation  = cc.sequence cc.moveTo(to_distance/@speed_per_sec, cc.p(to, position.y)),
                                      after_init_animation

      when 'left'
        from_distance   = position.x - from
        init_animation  = cc.sequence cc.moveTo(from_distance/@speed_per_sec, cc.p(from, position.y)),
                                      @_turn_to_right(),
                                      cc.moveTo((to-from)/@speed_per_sec, cc.p(to, position.y)),
                                      after_init_animation


    @runAction init_animation
    @walk()
    @moving = true


  walk: ->
    unless @walking
      speed = 0.6
      @walking = true
      left_animation = new cc.RepeatForever cc.sequence(cc.rotateTo(speed, 70), cc.rotateTo(speed, 110))
      right_animation = new cc.RepeatForever cc.sequence(cc.rotateTo(speed, 110), cc.rotateTo(speed, 70))
      @lamb_node.legs[0].runAction left_animation.clone()
      @lamb_node.legs[1].runAction right_animation.clone()
      @lamb_node.legs[2].runAction left_animation.clone()
      @lamb_node.legs[3].runAction right_animation.clone()


  speak: ->
    unless @speaking
      @speaking = true
      effect = cc.audioEngine.playEffect(res.audio.baaa, false)
      setTimeout =>
        cc.audioEngine.stopEffect effect
      , 3000
      @lamb_node.face.setTextureRect new cc.Rect 891, 200, 99, 74


  die: (callback) ->
    @stop()
    @gauge_node.runAction cc.sequence cc.hide()
    @lamb_node.runAction cc.sequence cc.EaseIn.create(cc.scaleTo(0.8, 0), 2)
    @lamb_node.shadow.runAction cc.sequence cc.EaseIn.create(cc.scaleTo(0.8, 0),2), new cc.CallFunc =>
      @parent.removeChild this, true
      callback() if callback instanceof Function


  dive: (callback) ->
    @set_direction @options.direction
    shadow = @lamb_node.shadow
    @lamb_node.removeChild shadow, false
    shadow.setAnchorPoint 0.5, 0.5
    shadow.attr x: 250*@options.scale, y: 10*@options.scale, scale: 0
    @addChild shadow
    @lamb_node.attr y: 700

    @lamb_node.runAction cc.sequence cc.EaseBounceOut.create(cc.moveTo(1.4, cc.p(@lamb_node.getPosition().x, 0)), 0)
    @lamb_node.shadow.runAction cc.sequence cc.EaseBounceOut.create(cc.scaleTo(1.4, @options.scale), 0),
      new cc.CallFunc => callback()

  set_direction: (direction) ->
    scale_x   = @lamb_node.getScaleX()
    direction = _(['left', 'right']).sample() unless direction
    current_direction = if scale_x > 0 then 'right' else 'left'

    @lamb_node.setScaleX scale_x*-1 unless current_direction is direction
    @direction = direction

  _turn_to_right: -> new cc.CallFunc => @set_direction 'right'
  _turn_to_left:  -> new cc.CallFunc => @set_direction 'left'


  _set_scale: ->
    @speed_per_sec = @speed_per_sec*@options.scale
    @lamb_node.setScale @options.scale
    width  = parseInt @lamb_node.getContentSize().width*@options.scale
    height = parseInt @lamb_node.getContentSize().height*@options.scale
    @setContentSize width, height
    @lamb_node.setPosition width/2, 0

  _set_position: ->
    size       = @getContentSize()
    half_width = size.width / 2

    @minimum = half_width
    @maximum = @stage.size.width - half_width

    @options.x = @maximum if @options.x > @maximum
    @options.x = @minimum if @options.x < @minimum

    @setPosition @options.x, @options.y


  onTouchBegan: ->
    if @[@events.touchstart] instanceof Function
      @[@events.touchstart].apply this, arguments
    else
      true

  onTouchMoved: ->
    @[@events.touchmove].apply this, arguments if @[@events.touchmove] instanceof Function

  onTouchEnded: ->
    @[@events.touchend].apply this, arguments if @[@events.touchend] instanceof Function