# Ball-Calc

Mobile ballistic calculator with rifle/load/range presets, local weather, compass and incline sensors.

Hosted at https://bcariveau.github.io/Ball-Calc/. Open the site over https so GPS and the compass and incline sensors work.

## Bullet database

About 2,000 bullets from manufacturer-published data (Hornady, Sierra, Speer, Berger, Nosler, Barnes, Lapua, Hammer, Cutting Edge) plus some older entries from [ammolytics/projectiles](https://github.com/ammolytics/projectiles) (MIT). Factory BCs can be optimistic. Regenerate with `python3 db/build_db.py`.

## Shot log

Sessions per rifle and load. Import an Athlon Rangecraft Velocity PRO `.xlsx` or `.csv` (format reference: XeroConv, MIT). Data stays in the browser; back up with Export.
