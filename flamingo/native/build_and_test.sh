RED="\033[0;31m"
GREEN="\033[0;32m"
NC="\033[0m" # No Color

echo "Building DDLog program..."
ddlog -i ./logic.dl -L $DDLOG_LIB
(cd logic_ddlog && cargo build --release)
echo "$GREEN Done with Build! $NC"
echo "Beginning tests..."

for testname in tests/*.dat; do
    echo "Running $testname"
    ./logic_ddlog/target/release/logic_cli < $testname > "$testname.output"

    if git status | grep -q $testname; then
        echo "$RED Test $testname failed! Check Git status $NC"
        allpassed="false"
    else
        echo "$GREEN Test $testname passed! $NC"
    fi
done

if $allpassed; then
    echo "$GREEN All tests passed! $NC"
else
    echo "$RED One or more tests failed! $NC"
fi
