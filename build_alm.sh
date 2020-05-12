#!/bin/bash
set -e

if [ ./src/logic.alm -nt ./.last_modified ]; then
    . ~/.profile
    date > .last_modified
    flamingo ./src/logic.alm > node_modules/flamingo-runtime/native/logic.dl
    cd node_modules/flamingo-runtime/native
    ddlog -i ./logic.dl
else
  echo "ALM file has not changed. Skipping build."
fi

