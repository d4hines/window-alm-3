. ~/.profile
flamingo ./src/logic.alm > node_modules/flamingo-runtime/native/logic.dl
cd node_modules/flamingo-runtime/native
ddlog -i ./logic.dl
