set x=%cd%
cd build
7z a -tzip "%x%.xpi" * -r -mx=9
move "%x%.xpi" ..\
cd ..