# DIP switches and debug modes

- This mostly is documentation for myself, it probably is of limited use for
  casual user.
- The most realistic use case would be for possibly easier brightness adjustment
  through a pot, when your device is disassembled and powered off - you can then
  plug in USB into the OLED Display Module and switch DIP 6 on to see
  some text on the OLED while adjusting the pot.

When done, remember to return all DIPs Off (switches being in the position closer to module center),
otherwise this will interfere with normal operation.

## DIP switch Location

DIP switches are located under OLED. To access them, OLED needs to be slid out:
Press down the plastic clip against the board (clip is located nearest the longer board edge,
where USB socket is located) and while holding it, slide the OLED up.

These DIP switches let enable different test modes; and you should be able to power the OLED separately with a micro USB cable plugged into it. Though, it might be of limited use, if it’s hard to access or more trouble to access OLED panel to be slid out.

Though, if you actually find use for DIP switches — after adjusting, remember to **turn off all** the debug DIP switches (4-7), otherwise test mode **will** interfere with the normal functioning.

- DIP 1: inverted mode;
- DIP 2 & 3: brightness adjust: both off = manual adjust with pot; the rest of the combinations are lowest, medium and highest brightness override (will ignore adjustment pot);
- DIP 4: internal debug mode (for my testing of faulty solder joints etc.) - shows firmware version
- DIP 5: OLED test with a sliding unlit vertical segment (may be inverted with DIP 1)
- DIP 6: shows some test text
- DIP 7: put on a screen sample of Analog Keys Mk1 (fw v1.0.2) or debug printf through USB CDC serial (fw v1.0.1)

## Use for troubleshooting

If it happens that after soldering module in and powering on the device you do not
get anything on the OLED

1. Do a quick visual check of all the solder joints - all should have nice
   fillets, as well as no excess solder (possibly short-circuiting/bridging something).
2. If everything seems right, next you should check if the OLED panel itself is working by:

- enabling DIP 6;
- powering the module directly from (a known to be good) micro-USB with 5V.
  The OLED should display text with a website.
  If it does not, then most likely problem is, that the flat-flex cable from OLED
  panel to display module board has come loose and you can try to reseat it.

If that does not help, you either have a broken OLED panel or the board
has some fault.

3. If display is working, then:

- enable DIP 4 (and disable all other ones, including DIP 6) you should see
  "DBG", "fw" + version and some debugging graphics (which correlate to pin
  states);
- disconnect the micro-USB and record and send me a video of the DBG screen, while you power on your
  Elektron device (it should reveal if any input pins are not sending anything
  to the module and there is no connection there).

You might be able to use USB-power (in DIP-4 debug mode) + DMM in diode mode to
test, that all the signal from motherboard is received in the OLED module.

In the worst case, you just send me your module and I will try to fix it.
