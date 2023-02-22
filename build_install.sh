#!/bin/sh
go build && sudo install gowlcd /usr/local/sbin/ && sudo systemctl restart gowlcd && sleep 1 && sudo systemctl --no-pager status gowlcd
