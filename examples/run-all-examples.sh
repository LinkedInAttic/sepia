echo -e "\033[1;32mYou shouldn't see any red, only green!\033[0m"
echo

rm -rf fixtures/ # no error if the fixtures directory doesn't exist

VCR_MODE=record   node examples/examples
VCR_MODE=playback node examples/examples

rm -r fixtures/
VCR_MODE=cache node examples/cache

rm -r fixtures/
VCR_MODE=cache node examples/headers

rm -r fixtures/
VCR_MODE=cache node examples/forceLive
