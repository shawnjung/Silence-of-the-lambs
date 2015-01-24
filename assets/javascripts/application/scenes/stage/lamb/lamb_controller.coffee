class App.Scenes.Stage.LambController extends App.NodeController
  speed_per_sec: 180
  speaking: false
  walking:  false
  moving:   false
  direction: 'right'
  patience_levels: _.range(10,20)

  initialize: ->
    @patience = _(@patience_levels).sample()
    @lamb_node = new App.Scenes.Stage.LambNode
    @gauge_node = new App.Scenes.Stage.GaugeNode
    @addChild @lamb_node, 0
    @addChild @gauge_node, 1

    @main_node = @lamb_node

  events:
    'enter': 'start'
    'touchstart': 'smile_and_move'

  start: ->
    @start_patience_gauge()
    @set_direction @options.direction
    @move_around 0, @parent.size.width



  start_patience_gauge: ->
    @gauge_node.start patience: @patience, => @speak()

  smile_and_move:  ->
    @gauge_node.reset()


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


  stand: ->
    @moving = false
    @walking = false
    _(@lamb_node.legs).each (leg) =>
      leg.stopAllActions()
      leg.runAction cc.sequence cc.rotateTo(0.6, 90)


  speak: ->
    unless @speaking
      @speaking = true
      @lamb_node.face.setTextureRect new cc.Rect 891, 200, 99, 74


  set_direction: (direction) ->
    scale_x   = @lamb_node.getScaleX()
    direction = _(['left', 'right']).sample() unless direction
    current_direction = if scale_x > 0 then 'right' else 'left'

    @lamb_node.setScaleX scale_x*-1 unless current_direction is direction
    @direction = direction

  _turn_to_right: -> new cc.CallFunc => @set_direction 'right'
  _turn_to_left:  -> new cc.CallFunc => @set_direction 'left'