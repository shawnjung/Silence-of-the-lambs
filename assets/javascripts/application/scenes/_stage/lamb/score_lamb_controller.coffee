class App.Scenes.Stage.ScoreLambController extends App.Scenes.Stage.LambController
  events:
    'touchstart': 'earn_score'

  earn_score:  ->
    cc.audioEngine.playEffect(res.audio.tap, false)
    if @active
      end_time   = new Date().getTime()
      spent_time = parseInt((end_time - @_start_time)/1000*100)/100
      rest_time  = @patience - spent_time

      total_score = @patience*1.6

      if rest_time < @patience/10
        score = total_score*2
      else
        spent_score = rest_time*1.6
        score = total_score - spent_score

      if rest_time < spent_time
        @stage.trigger 'score-earned', parseInt score
        @_render_score_overlay parseInt score
      @reset patience: _(@stage.patience_levels).sample()