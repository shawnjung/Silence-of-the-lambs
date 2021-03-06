window.res =
  HelloWorld_png: "res/HelloWorld.png"
  CloseNormal_png: "res/CloseNormal.png"
  CloseSelected_png: "res/CloseSelected.png"

  landing:
    sprite: 'assets/sprites/landing.png'
    background: 'assets/backgrounds/landing.png'

  pvp_landing:
    sprite: 'assets/sprites/pvp-landing.png'
    background: 'assets/backgrounds/pvp-landing.png'

  ending: 'assets/sprites/ending-messages.png'

  stage:
    lamb: 'assets/sprites/lamb.png'
    enermy_lamb: 'assets/sprites/enermy-lamb.png'

    labels:
      numbers: 'assets/sprites/numbers.png'
    backgrounds:
      grass: 'assets/backgrounds/grass.png'
  audio:
    baaa: 'audio/effects.m4a'
    background: 'audio/music.m4a'
    tap: 'audio/tap.m4a'







collect_resources = (resmap, output = []) ->
  _(resmap).map (val, key) ->
    if val instanceof Object
      collect_resources val, output
    else
      output.push val

  output

window.resource_urls = collect_resources res