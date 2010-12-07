#!/bin/bash

NAME="switcher"

rm $NAME.xpi
cd build || exit
zip -r ../$NAME.xpi *
