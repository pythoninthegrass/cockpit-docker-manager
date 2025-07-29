#!/usr/bin/env bash

# Suppress command output
# exec &> /dev/null

ORG_NAME=${ORG_NAME:-"chrisjbawden"}
REPO_NAME=${REPO_NAME:-"cockpit-docker-manager"}
FILE_NAME=${FILE_NAME:-"dockermanager.tar"}
TARGET_DIR=${TARGET_DIR:-"/usr/share/cockpit/dockermanager"}
TAR_URL="https://github.com/${ORG_NAME}/${REPO_NAME}/raw/refs/heads/main/${FILE_NAME}"

# Check if the OS is Ubuntu
if [ "$(lsb_release -si)" != "Ubuntu" ]; then
	echo "This script was created for Ubuntu"

	read -rp "This script is intended for Ubuntu - Do you want to continue? (y/n): " confirm
	if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
		echo "Script aborted."
		exit 1
	fi
fi

# Handle upgrade logic
if [ "$1" = "upgrade" ]; then
	if [ -d "$TARGET_DIR" ]; then
		rm -rf "$TARGET_DIR" || echo "Failed to delete existing directory."; exit 1
	fi
fi

# Backup existing directory if it exists
if [ -d "$TARGET_DIR" ]; then
	mv "$TARGET_DIR" "${TARGET_DIR}.bak" || echo "Failed to rename existing directory."; exit 1
fi

# Download .tar file from GitHub
wget "$TAR_URL" -O "$FILE_NAME"

# Create target directory and extract contents into it
mkdir -p "$TARGET_DIR"
tar -xf "$FILE_NAME" -C "$TARGET_DIR"

# Clean up tar file
rm "$FILE_NAME"

echo -e "\nDocker Manager deployed successfully to $TARGET_DIR"
