class App.Scenes.ScoreStageScene extends App.Scenes.Stage.BaseScene
  lamb_controller: App.Scenes.Stage.ScoreLambController
  constructor: (options = {}) ->
    @options = options
    super

  onEnter: ->
    super
    @_render_game_elements()
    @_start_tutorial =>
      @_start_score_mode()



  _start_tutorial: (callback) ->
    return callback() if @options.had_tutorial

    guide_lamb = new @lamb_controller
      scale: 0.8, x: @size.width/2, y: 120
      patience: 5, direction: 'right', stage: this

    finger = new App.Scenes.Stage.FingerNode
    arrow  = new cc.Sprite res.stage.lamb, new cc.Rect(840, 330, 40, 18);
    arrow.attr scale: 1.5, x: 120, y: 47
    guide_lamb.gauge_node.addChild arrow

    @runAction cc.sequence new cc.DelayTime(1), new cc.CallFunc =>
      @elements.addChild guide_lamb
      guide_lamb.dive =>
        guide_lamb._start_time = new Date().getTime()
        guide_lamb.gauge_node.runAction cc.show()
        guide_lamb.gauge_node.start()


    @runAction cc.sequence new cc.DelayTime(5), new cc.CallFunc =>
      finger.attr x: @size.width/2+140, y: 220
      @addChild finger
      finger.start()
      @touchables.push guide_lamb

    @once 'score-earned', =>
      finger.stop()
      guide_lamb.die =>
        @touchables.length = 0
        callback()




  _start_score_mode: ->
    @_render_game_overlays()
    @_render_lambs()
    @score_earned = 0

    @on 'time-over', (lamb) =>
      lamb.speak()
      @stop_all_lambs()
      @zoom_lamb lamb, =>
        @labels.activate_restart_button()
        lamb.show_gauge()

    @on 'score-earned', (score) =>
      @score_earned++
      @current_score += score
      @labels.score_label.update @current_score
      if @score_earned%5 is 0
        @render_lamb @_attributes_for_random_lamb()


  _render_game_overlays: ->
    @labels = new App.Scenes.Stage.ScoreModelLabelsNode
    @labels.attr x: 0, y: 0, width: @size.width, height: @size.height
    @addChild @labels, 700