cecho(){
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    # ... ADD MORE COLORS
    NC="\033[0m" # No Color

    printf "${!1}${2} ${NC}\n"
}

echo "Building DDLog program..."
ddlog -i ./logic.dl -L $DDLOG_LIB
(cd logic_ddlog && cargo build --release)
cecho "GREEN" "Done with Build!"
echo "Beginning tests..."

for testname in tests/*.dat; do
    echo "Running $testname"
    ./logic_ddlog/target/release/logic_cli < $testname > "$testname.output"

    if git status | grep -q $testname; then
        cecho "RED" "Test $testname failed! Check Git status"
    else
        cecho "GREEN" "Test $testname passed!"
    fi
done