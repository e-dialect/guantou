#!/usr/bin/env bash

# Copyright 2022 Charlie Chiang.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -o errexit
set -o nounset
set -o pipefail

PREVIOUS_SHA_FILE="${1:-sha256sum.txt}"

if [ ! -f "${PREVIOUS_SHA_FILE}" ]; then
    echo "Previous SHA file not found, skipping incremental diff."
    exit 0
fi

# Generate SHA256 by:
# find dist/build/h5 -type f -exec sha256sum {} \; > dist/build/h5/sha256sum.txt

IFS=$'\n'
FILE_LIST=($(cat "${PREVIOUS_SHA_FILE}" | awk -F '  ' '{ print $2 }'))
SHA_LIST=($(cat "${PREVIOUS_SHA_FILE}" | awk -F '  ' '{ print $1 }'))

for ((i = 0; i < ${#FILE_LIST[@]}; i++)); do
    CURRENT_FILE="${FILE_LIST[$i]}"
    CURRENT_SHA="${SHA_LIST[$i]}"
    if [ ! -f "${CURRENT_FILE}" ]; then
        continue
    fi
    ACTUAL_SHA=$(sha256sum "${CURRENT_FILE}" | awk -F '  ' '{ print $1 }')
    if [[ "${ACTUAL_SHA}" == "${CURRENT_SHA}" ]]; then
        rm -f "${CURRENT_FILE}"
    fi
done

echo "These files will be uploaded after diff:"
find dist/build/h5 -type f -exec echo "    {}" \;
echo -n "Total size: "
du -sh dist/build/h5 | awk '{ print $1 }'
