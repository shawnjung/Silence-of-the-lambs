class App.Scenes.ScoreStageScene extends App.Scenes.Stage.BaseScene
  constructor: (options = {}) ->
    @options = options
    super

  onEnter: ->
    super
    @_render_game_elements()
    @_start_tutorial =>
      @_start_score_mode()

    @_startEventListener()



  _start_tutorial: (callback) ->
    return callback() if @options.had_tutorial

    guide_lamb = new App.Scenes.Stage.LambController
      scale: 0.8, x: @size.width/2, y: 120

    guide_lamb.patience = 5

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

    @elements.on 'time-over', (lamb) =>

      @stop_all_lambs()
      @zoom_lamb lamb, =>
        console.log 'wtf'
        console.log @labels
        @labels.active_restart_button()
        lamb.speak()

    @on 'score-earned', (score) =>
      @score_earned++
      @current_score += score
      @labels.score_label.update @current_score
      @render_lamb() if @score_earned%5 is 0