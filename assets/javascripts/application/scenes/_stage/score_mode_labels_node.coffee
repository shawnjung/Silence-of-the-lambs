class App.Scenes.Stage.ScoreModelLabelsNode extends cc.Node
  onEnter: ->
    super
    @_render_current_score()
    @_render_back_button()
    @_render_restart_button()
    @_render_lost_image()

  _render_current_score: ->
    @score_label = new App.Scenes.Stage.Labels.NumbersNode numbers: 0, align: 'right'
    @score_label.attr x: cc.winSize.width-20, y: 550, scale: 0.6
    @addChild @score_label


  _render_restart_button: ->
    @restart_button = new cc.Sprite res.stage.lamb, new cc.Rect(110, 430, 110, 106);
    @restart_button.setAnchorPoint 0.5, 0
    @restart_button.attr x: cc.winSize.width/2, y: 60, opacity: 0
    @addChild @restart_button

    @restart_button.onTouchBegan = =>
      cc.director.runScene  cc.TransitionFade.create 1,
                            new App.Scenes.ScoreStageScene(had_tutorial: true),
                            new cc.Color(0,0,0);

  _render_lost_image: ->
    @lost_image = new cc.Sprite res.ending, new cc.Rect(0, 0, 1136, 120);
    @lost_image.setAnchorPoint 0, 0
    @lost_image.attr x: 0, y: 240, opacity: 0
    @addChild @lost_image


  active_restart_button: ->
    @lost_image.runAction cc.sequence new cc.DelayTime(0.5), cc.fadeIn(0.4)
    @restart_button.runAction cc.sequence new cc.DelayTime(0.5), cc.fadeIn(0.4), new cc.CallFunc =>
      @parent.touchables = [@restart_button, @back_button]




  _render_back_button: ->
    @back_button = new cc.Sprite res.stage.lamb, new cc.Rect(0, 430, 110, 106);
    @back_button.setAnchorPoint 0, 0
    @back_button.attr x: 10, y: 550, scale: 0.7
    @addChild @back_button

    @parent.touchables.push @back_button

    @back_button.onTouchBegan = =>
      cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.LandingScene, new cc.Color(0,0,0);