# 原创测量反例字体：只有空白和两个矩形字形，无外部字体素材。
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
fb=FontBuilder(1000,isTTF=True)
order=['.notdef','space','star','star.tr']
fb.setupGlyphOrder(order)
fb.setupCharacterMap({32:'space',42:'star'})
def rect(x1,y1,x2,y2):
 p=TTGlyphPen(None);p.moveTo((x1,y1));p.lineTo((x2,y1));p.lineTo((x2,y2));p.lineTo((x1,y2));p.closePath();return p.glyph()
empty=TTGlyphPen(None).glyph()
fb.setupGlyf({'.notdef':empty,'space':empty,'star':rect(100,100,400,700),'star.tr':rect(1200,100,2500,700)})
fb.setupHorizontalMetrics({'.notdef':(500,0),'space':(500,0),'star':(500,100),'star.tr':(500,1200)})
fb.setupHorizontalHeader(ascent=800,descent=-200)
fb.setupNameTable({'familyName':'ReviewLocale','styleName':'Regular','uniqueFontIdentifier':'ReviewLocale Regular','fullName':'ReviewLocale Regular','psName':'ReviewLocale-Regular','version':'Version 1.0'})
fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
fb.setupPost()
addOpenTypeFeaturesFromString(fb.font,'''languagesystem DFLT dflt; languagesystem DFLT TRK; languagesystem latn dflt; languagesystem latn TRK;
feature locl { script DFLT; language TRK; sub star by star.tr; script latn; language TRK; sub star by star.tr; } locl;''')
from pathlib import Path
fb.save(Path(__file__).with_name('locale.ttf'))
