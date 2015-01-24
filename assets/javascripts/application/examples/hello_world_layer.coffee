class App.Layers.HelloWorld extends cc.Layer
  sprite: null,
  constructor: ->
    ##################################
    ## 1. super init first
    super

    ##################################
    ## 2. add a menu item with "X" image, which is clicked to quit the program
    ##    you may modify it.
    ## ask the window size
    @size = cc.winSize;
    @render_close_button()
    @render_hello_world_label()
    @render_hello_world_image()
    true

  render_close_button: ->
    ## add a "close" icon to exit the progress. it's an autorelease object
    closeItemCallback = -> cc.log("Menu is clicked!");
    closeItem = new cc.MenuItemImage res.CloseNormal_png, res.CloseSelected_png, closeItemCallback, this

    closeItem.attr
      x: @size.width - 20
      y: 20
      anchorX: 0.5
      anchorY: 0.5

    menu = new cc.Menu closeItem
    menu.x = 0
    menu.y = 0
    @addChild menu, 1

  render_hello_world_label: ->
    ##################################
    ## 3. add your codes below...
    ## add a label shows "Hello World"

    ## create and initialize a label
    helloLabel = new cc.LabelTTF "Hello World", "Arial", 38

    ## position the label on the center of the screen
    helloLabel.x = @size.width / 2
    helloLabel.y = 0

    ## add the label as a child to this layer
    @addChild helloLabel, 5

    helloLabel.runAction cc.spawn(cc.moveBy(2.5, cc.p(0, @size.height - 40)), cc.tintTo(2.5,255,125,0))

  render_hello_world_image: ->
    @sprite = new cc.Sprite res.HelloWorld_png
    @sprite.attr
        x: @size.width / 2
        y: @size.height / 2
        scale: 0.5
        rotation: 180

    @addChild @sprite, 0
    @sprite.runAction cc.sequence(cc.rotateTo(2, 0), cc.scaleTo(2, 1, 1))