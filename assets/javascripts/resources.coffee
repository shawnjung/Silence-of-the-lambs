window.res =
  HelloWorld_png: "res/HelloWorld.png"
  CloseNormal_png: "res/CloseNormal.png"
  CloseSelected_png: "res/CloseSelected.png"


  stage:
    lamb: 'assets/sprites/lamb.png'
    labels:
      numbers: 'assets/sprites/numbers.png'
    backgrounds:
      grass: 'assets/backgrounds/grass.png'






collect_resources = (resmap, output = []) ->
  _(resmap).map (val, key) ->
    if val instanceof Object
      collect_resources val, output
    else
      output.push val

  output

window.resource_urls = collect_resources res