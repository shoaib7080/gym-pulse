#!/usr/bin/env bash
# Download Stitch project screens and code using curl -L
# Project: GymPulse Admin Dashboard Suite (ID: 12961325546557867269)

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "Downloading Screen 1 (ID: c3f29c5880f34a7495c8609dfcf6e302)..."
curl -L "https://lh3.googleusercontent.com/aida/AEtjO1UoSF0LWG4kXw5AfXwM0lQwdGfXOXmL83v20Mphn9zpMyhD-EP2yc46EJLkrpstAY0nf6u5JBIk4dRlY7iph9YcMUfYzgDKlRB7ILCroARppMKjcPJberXCcVzKpVN5Qb9GOr31Kn64Rvk11kHbqzYHcZK-4TzMNH2VqTOQrBygpPy5NgjcyrYLBIGbtukOfkkCvjiyL5eV579Vy3i--g4aR2XG0U28vRrkZznPgUlDzQyqXYMqWaDuBNop" -o "$DIR/screen_1_c3f29c5880f34a7495c8609dfcf6e302.jpg"
curl -L "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZTcyODBmOGE0ZWQwNWYxM2I4YmZiMzI0MzQ4EgsSBxDXyrO0rggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjk2MTMyNTU0NjU1Nzg2NzI2OQ&filename=&opi=89354086" -o "$DIR/screen_1_c3f29c5880f34a7495c8609dfcf6e302.html"

echo "Downloading Screen 2 (ID: 5f498321859a4712affe48f42afc9fb6)..."
curl -L "https://lh3.googleusercontent.com/aida/AEtjO1VvRfGG7ttr8964OXT86D1L1HcOLICiFaCK1mFGQMpE0TwQTcy8mku7DkBNv3FtGO90hn-niaGbl_YLQdS3XZM7CpS6xaCGOb1b_JdFZXQ6Vtl6Y4CXT8_eY9SG3rrsLYkyeI1qOfpzJ41C8FwWUmQps2CdJQOBp6blTv3srpT78pgyWYnmEb2sb50dT1iqXGMQPBCszRThB9ZvNL_e_DADs6_9xksTorx5nDmCDW4Kk1nxnmXf3bf9oq63" -o "$DIR/screen_2_5f498321859a4712affe48f42afc9fb6.jpg"
curl -L "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZTZjNmRkZGU4MzMwNDRmNjEyNmJkMWQ2OTc0EgsSBxDXyrO0rggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjk2MTMyNTU0NjU1Nzg2NzI2OQ&filename=&opi=89354086" -o "$DIR/screen_2_5f498321859a4712affe48f42afc9fb6.html"

echo "Downloading Screen 3 (ID: d93d5eb8ef104ebcbdc0c86ce212c465)..."
curl -L "https://stitch.googleapis.com/v1/projects/12961325546557867269/files/14364092766710371861:download" -o "$DIR/screen_3_d93d5eb8ef104ebcbdc0c86ce212c465.jpg"
curl -L "https://stitch.googleapis.com/v1/projects/12961325546557867269/files/14873006941773109718:download" -o "$DIR/screen_3_d93d5eb8ef104ebcbdc0c86ce212c465.html"

echo "All Stitch project screens and code successfully downloaded!"
