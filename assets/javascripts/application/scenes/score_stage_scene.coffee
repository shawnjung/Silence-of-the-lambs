class App.Scenes.ScoreStageScene extends App.Scenes.Stage.BaseScene
  onEnter: ->
    super
    @_render_game_elements()
    @_start_tutorial()

    @_startEventListener()



  _start_tutorial: ->
    guide_lamb = new App.Scenes.Stage.LambController
      scale: 0.8, x: @size.width/2, y: 120

    guide_lamb.patience = 5

    @runAction cc.sequence new cc.DelayTime(1), new cc.CallFunc =>
      @elements.addChild guide_lamb
      guide_lamb.dive =>
        guide_lamb._start_time = new Date().getTime()
        guide_lamb.gauge_node.runAction cc.show()
        guide_lamb.gauge_node.start()

    @touchables.push guide_lamb

    @once 'score-earned', =>
      guide_lamb.die =>
        @touchables.length = 0
        @_start_score_mode()


  _start_score_mode: ->
    @_render_game_overlays()
    @_render_lambs()
    @score_earned = 0

    @elements.on 'time-over', (lamb) =>
      @stop_all_lambs()
      @zoom_lamb lamb, => lamb.speak()

    @on 'score-earned', (score) =>
      @score_earned++
      @current_score += score
      @labels.score_label.update @current_score
      @render_lamb() if @score_earned%5 is 0