import {context} from '@actions/github'
import * as child from 'child_process'
import * as fs from 'fs'

export class Helper {
  public currentBuild: typeof context

  public constructor(currentBuild: typeof context) {
    this.currentBuild = currentBuild
  }
}

export let helper: Helper

export function setHelper(helperInstance: Helper) {
  helper = helperInstance
}

export function createMetaJson(root: string): string[] {
  const execSync = child.execSync
  console.log('Run number: ' + helper.currentBuild.runNumber)
  const xmllint = execSync('sudo apt install libxml2-utils', {
    shell: '/bin/bash'
  })
  console.log(xmllint.toString())
  const command =
    `#!/bin/bash
    cd ` +
    root +
    `
    find . -name 'pom.xml' -type f > ` +
    root +
    `poms.txt
    `
  const output = execSync(command, {shell: '/bin/bash'})
  console.log(output.toString())
  const ret: string[] = []
  const poms = fs.readFileSync(root + 'poms.txt', 'utf8').toString()
  const ownersFile = fs
    .readFileSync(root + '.github/CODEOWNERS', 'utf8')
    .toString()
  for (const pomRaw of poms.split('\n')) {
    const pom = pomRaw.replace('./', '/')
    const name = pom.split('/')[2]
    if (
      pom.startsWith('/components') &&
      pom.indexOf(name + '-deployment/') > -1
    ) {
      const owners = []
      const reviewers = []
      for (const ownerRaw of ownersFile.split('\n')) {
        const path = ownerRaw.split(' ')[0]

        if (
          path.length > 3 &&
          ownerRaw.indexOf(' @') > -1 &&
          pom.startsWith(path)
        ) {
          owners.push(ownerRaw.split(' ')[1])
          reviewers.push(ownerRaw.split(' ')[1])
        }
      }
      const gid =
        `#!/bin/bash
            cd ` +
        root +
        `
            xmllint --xpath "/*[local-name()='project']/*[local-name()='groupId']/text()" .` +
        pom +
        `
            `
      const aid =
        `#!/bin/bash
            cd ` +
        root +
        `
            xmllint --xpath "/*[local-name()='project']/*[local-name()='artifactId']/text()" .` +
        pom +
        `
            `
      const groupId = execSync(gid, {shell: '/bin/bash'}).toString()
      console.log(groupId)
      const artifactId = execSync(aid, {shell: '/bin/bash'}).toString()
      console.log(artifactId)
      const meta: {[key: string]: any} = {}
      meta['manifestSource'] = pom.replace('/pom.xml', '').substring(1)
      meta['manifestTarget'] =
        'helm-chart/components/charts/' +
        name +
        '/' +
        name +
        '-deployment/templates/'
      meta['owners'] = owners
      meta['reviewers'] = reviewers
      meta['branchName'] = name + '-deployment'
      meta['mavenGroupId'] = groupId.trim()
      meta['mavenArtifactId'] = artifactId.trim()
      console.log(JSON.stringify(meta))
      ret.push(pomRaw.replace('/pom.xml', '/meta.json').substring(1))
      fs.writeFileSync(
        root + pomRaw.replace('/pom.xml', '/meta.json').substring(1),
        JSON.stringify(meta)
      )
    }
  }
  return ret
}
