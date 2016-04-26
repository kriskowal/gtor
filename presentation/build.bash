#!/bin/bash

WW=$(inkscape -W "$PWD/gtor-master.svg")
HH=$(inkscape -H "$PWD/gtor-master.svg")

for NAME in perspective-value duals-value perspective-collection duals-iterator duals-deferred duals-generator-function duals-generator duals-generator-observer perspective-promise promise-order-independence promise-queue-order-independence promise-queue-temporal-independence promise-queue-iteration-transport duals-buffer duals-promsie-queue stream-using-queues perspective-stream
do
	X=$(inkscape -X -I $NAME "$PWD/gtor-master.svg")
	Y=$(inkscape -Y -I $NAME "$PWD/gtor-master.svg")
	W=$(inkscape -W -I $NAME "$PWD/gtor-master.svg")
	H=$(inkscape -H -I $NAME "$PWD/gtor-master.svg")
	X0=$(echo "$X" | bc -l)
	Y0=$(echo "$HH - $Y" | bc -l)
	X1=$(echo "$X + $W" | bc -l)
	Y1=$(echo "$HH - $Y - $H" | bc -l)
	inkscape -z -e $PWD/$NAME.png -a "$X0:$Y0:$X1:$Y1" -w 600 $PWD/gtor-master.svg 2>/dev/null
done
